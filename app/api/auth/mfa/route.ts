import {requireUser,problem,failure,noCache,boundedRequest} from '../../../lib/server';
import {query,transaction} from '../../../lib/db';
import {settings,verifyPassword} from '../../../lib/auth';
import {encryptMfaSecret,newMfaSecret,newRecoveryCode,recoveryCodeHash,decryptMfaSecret,validTotp} from '../../../lib/mfa';
import {z} from 'zod';

const startInput=z.object({password:z.string().min(1).max(256)}).strict();
const confirmInput=z.object({code:z.string().regex(/^\d{6}$/)}).strict();
export async function GET(req:Request){try{
  const user=await requireUser(req);if(user.role!=='admin')throw new Error('ROLE');
  const r=await query(`SELECT enabled_at IS NOT NULL AS enabled,
    (SELECT count(*)::int FROM admin_recovery_codes WHERE user_id=$1 AND used_at IS NULL) AS "recoveryRemaining"
    FROM admin_mfa WHERE user_id=$1`,[user.id]);
  return Response.json({enabled:!!r.rows[0]?.enabled,pending:!!r.rowCount&&!r.rows[0]?.enabled,recoveryRemaining:r.rows[0]?.recoveryRemaining||0},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
  const user=await requireUser(request);if(user.role!=='admin')throw new Error('ROLE');
  const req=await boundedRequest(request,4096),parsed=startInput.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const account=await query<{password_hash:string}>('SELECT password_hash FROM users WHERE id=$1 AND status=$2',[user.id,'active']);
  if(!account.rowCount||!await verifyPassword(parsed.data.password,account.rows[0].password_hash))return problem('Contraseña incorrecta.',403);
  const secret=newMfaSecret(),codes=Array.from({length:8},()=>newRecoveryCode());
  await transaction(async client=>{
    const current=await client.query('SELECT enabled_at FROM admin_mfa WHERE user_id=$1 FOR UPDATE',[user.id]);
    if(current.rows[0]?.enabled_at)throw new Error('CONFLICT');
    await client.query(`INSERT INTO admin_mfa(user_id,encrypted_secret) VALUES($1,$2)
      ON CONFLICT(user_id) DO UPDATE SET encrypted_secret=$2,enabled_at=NULL,created_at=now()`,
      [user.id,encryptMfaSecret(secret,settings().secret)]);
    await client.query('DELETE FROM admin_recovery_codes WHERE user_id=$1',[user.id]);
    for(const code of codes)await client.query('INSERT INTO admin_recovery_codes(user_id,code_hash) VALUES($1,$2)',[user.id,recoveryCodeHash(code)]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id)
      VALUES($1,'mfa_prepare','user',$1)`,[user.id]);
  });
  const uri=`otpauth://totp/${encodeURIComponent('Vitala:'+user.email)}?secret=${secret}&issuer=Vitala&algorithm=SHA1&digits=6&period=30`;
  return Response.json({secret,uri,codes},{headers:noCache});
}catch(e){return failure(e)}}
export async function PATCH(request:Request){try{
  const user=await requireUser(request);if(user.role!=='admin')throw new Error('ROLE');
  const req=await boundedRequest(request,4096),parsed=confirmInput.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const activated=await transaction(async client=>{
    const r=await client.query('SELECT encrypted_secret,enabled_at FROM admin_mfa WHERE user_id=$1 FOR UPDATE',[user.id]);
    if(!r.rowCount||r.rows[0].enabled_at)throw new Error('CONFLICT');
    const secret=decryptMfaSecret(r.rows[0].encrypted_secret,settings().secret);
    if(!validTotp(secret,parsed.data.code))return false;
    await client.query('UPDATE admin_mfa SET enabled_at=now() WHERE user_id=$1',[user.id]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id)
      VALUES($1,'mfa_enable','user',$1)`,[user.id]);
    return true;
  });
  if(!activated)return problem('Código incorrecto o caducado.',400);
  return Response.json({enabled:true},{headers:noCache});
}catch(e){return failure(e)}}

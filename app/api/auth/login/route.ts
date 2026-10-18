import {checkOrigin,cookieName,createSession,settings,verifyPassword} from '../../../lib/auth';
import {query,transaction} from '../../../lib/db';
import {boundedRequest,failure} from '../../../lib/server';
import {NextResponse} from 'next/server';
import {createHmac} from 'node:crypto';
import {decryptMfaSecret,recoveryCodeHash,validTotp} from '../../../lib/mfa';
export const runtime='nodejs';
export async function POST(request:Request){try{
  const incoming=await boundedRequest(request,4096),form=await incoming.formData();
  checkOrigin(request,String(form.get('csrfToken')||''));const config=settings();
  const rawIp=process.env.FLY_APP_NAME?request.headers.get('fly-client-ip')||'fly-unknown':'local';
  const rateKey=createHmac('sha256',config.secret).update(rawIp.slice(0,128)).digest('hex');
  const allowed=await transaction(async client=>{
    await client.query('DELETE FROM login_limits WHERE expires_at<=now()');
    const r=await client.query(`INSERT INTO login_limits(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
      ON CONFLICT(key) DO UPDATE SET attempts=login_limits.attempts+1 RETURNING attempts`,[rateKey]);
    return r.rows[0].attempts<=10;
  });
  if(!allowed)return NextResponse.redirect(new URL('/login?error=rate',config.origin),303);
  const email=String(form.get('email')||'').trim().toLowerCase(),password=String(form.get('password')||'');
  const found=await query<{id:string;password_hash:string}>(`SELECT id,password_hash FROM users WHERE email=$1 AND status='active'`,[email]);
  const valid=found.rows[0]&&await verifyPassword(password,found.rows[0].password_hash);
  if(!valid)return NextResponse.redirect(new URL('/login?error=invalid',config.origin),303);
  const mfaCode=String(form.get('mfaCode')||'').trim();
  const secondFactor=await transaction(async client=>{
    const mfa=await client.query('SELECT encrypted_secret FROM admin_mfa WHERE user_id=$1 AND enabled_at IS NOT NULL FOR UPDATE',[found.rows[0].id]);
    if(!mfa.rowCount)return true;
    const secret=decryptMfaSecret(mfa.rows[0].encrypted_secret,config.secret);
    if(validTotp(secret,mfaCode))return true;
    const codeHash=recoveryCodeHash(mfaCode);
    if(!codeHash)return false;
    const used=await client.query(`UPDATE admin_recovery_codes SET used_at=now()
      WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING code_hash`,[found.rows[0].id,codeHash]);
    return !!used.rowCount;
  });
  if(!secondFactor)return NextResponse.redirect(new URL('/login?error=invalid',config.origin),303);
  const response=NextResponse.redirect(new URL('/',config.origin),303);
  response.headers.set('Cache-Control','no-store');
  response.cookies.set(cookieName(),await createSession(found.rows[0].id),{httpOnly:true,secure:config.secure,sameSite:'strict',path:'/',maxAge:8*3600});
  return response;
}catch(e){return failure(e)}}

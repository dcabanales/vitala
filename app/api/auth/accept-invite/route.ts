import {checkOrigin,cookieName,passwordHash,tokenHash} from '../../../lib/auth';
import {transaction} from '../../../lib/db';
import {boundedRequest,failure} from '../../../lib/server';
import {NextResponse} from 'next/server';
export async function POST(request:Request){try{
  const req=await boundedRequest(request,4096),form=await req.formData();checkOrigin(request,String(form.get('csrfToken')||''));
  const token=String(form.get('token')||''),password=String(form.get('password')||'');
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('VALIDATION');
  const hash=await passwordHash(password);
  await transaction(async client=>{
    const found=await client.query(`SELECT * FROM invitations WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE`,[tokenHash(token)]);
    const invite=found.rows[0];if(!invite)throw new Error('VALIDATION');
    const patient=await client.query('SELECT patient_user_id FROM patients WHERE id=$1 FOR UPDATE',[invite.patient_id]);
    if(!patient.rowCount||patient.rows[0].patient_user_id)throw new Error('CONFLICT');
    const account=await client.query(`INSERT INTO users(email,password_hash,role) VALUES($1,$2,'patient') RETURNING id`,[invite.email,hash]);
    const userId=account.rows[0].id;
    await client.query('UPDATE patients SET patient_user_id=$2,updated_at=now() WHERE id=$1',[invite.patient_id,userId]);
    await client.query(`INSERT INTO patient_access_grants(patient_id,user_id,access_level,authorized_by,basis,created_by)
      VALUES($1,$2,'read',$3,'Acceso a su propio expediente',$4)`,[invite.patient_id,userId,invite.email,invite.created_by]);
    await client.query('UPDATE invitations SET used_at=now() WHERE token_hash=$1',[tokenHash(token)]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'accept_invite','patient',$2,$2)`,[userId,invite.patient_id]);
  });
  const r=NextResponse.redirect(new URL('/login?welcome=1',request.url),303);
  r.cookies.set(cookieName(),'',{path:'/',maxAge:0});return r;
}catch(e){return failure(e)}}

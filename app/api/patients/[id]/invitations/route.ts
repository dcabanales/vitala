import {emailReady,sendInvitationEmail} from '../../../../lib/invitation-email';
import {newOpaqueToken,tokenHash,settings} from '../../../../lib/auth';
import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const input=z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase())}).strict();
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,4096),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const token=newOpaqueToken();
  await transaction(async client=>{
    const patient=await client.query('SELECT patient_user_id,archived_at FROM patients WHERE id=$1 FOR UPDATE',[id]);
    if(!patient.rowCount||patient.rows[0].archived_at)throw new Error('PATIENT');
    if(patient.rows[0].patient_user_id)throw new Error('CONFLICT');
    if((await client.query('SELECT 1 FROM users WHERE email=$1',[parsed.data.email])).rowCount)throw new Error('DUPLICATE');
    await client.query('UPDATE invitations SET revoked_at=now() WHERE patient_id=$1 AND used_at IS NULL AND revoked_at IS NULL',[id]);
    await client.query(`INSERT INTO invitations(token_hash,email,patient_id,created_by,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '24 hours')`,[tokenHash(token),parsed.data.email,id,user.id]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'invite','patient',$2,$2)`,[user.id,id]);
  });
  const invitationUrl=new URL('/invite/'+token,settings().origin).toString();
  const delivery=await sendInvitationEmail(parsed.data.email,invitationUrl,tokenHash(token));
  return Response.json({invitationUrl,expiresInHours:24,delivery},{status:201,headers:noCache});
}catch(e){return failure(e)}}

export async function GET(req:Request,{params}:Context){try{
 const user=await requireUser(req),{id}=await params;await authorizePatient(user,id,true);
 const account=(await query(`SELECT u.email,u.status,g.revoked_at AS "revokedAt",g.expires_at AS "expiresAt" FROM patients p JOIN users u ON u.id=p.patient_user_id LEFT JOIN patient_access_grants g ON g.patient_id=p.id AND g.user_id=u.id WHERE p.id=$1`,[id])).rows[0]||null;
 const invitations=(await query(`SELECT email,expires_at AS "expiresAt",used_at AS "usedAt",revoked_at AS "revokedAt",created_at AS "createdAt" FROM invitations WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 10`,[id])).rows;
 return Response.json({account,invitations,emailConfigured:emailReady()},{headers:noCache});
}catch(e){return failure(e)}}
export async function DELETE(req:Request,{params}:Context){try{
 const user=await requireUser(req),{id}=await params;await authorizePatient(user,id,true);
 await transaction(async client=>{await client.query('SELECT id FROM patients WHERE id=$1 FOR UPDATE',[id]);await client.query('UPDATE invitations SET revoked_at=now() WHERE patient_id=$1 AND used_at IS NULL AND revoked_at IS NULL',[id]);await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'revoke_invitation','patient',$2,$2)`,[user.id,id])});
 return Response.json({ok:true},{headers:noCache});
}catch(e){return failure(e)}}

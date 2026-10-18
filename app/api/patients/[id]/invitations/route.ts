import {newOpaqueToken,tokenHash} from '../../../../lib/auth';
import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const input=z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase())}).strict();
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,4096),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const token=newOpaqueToken();
  await transaction(async client=>{
    const patient=await client.query('SELECT patient_user_id FROM patients WHERE id=$1 FOR UPDATE',[id]);
    if(patient.rows[0]?.patient_user_id)throw new Error('CONFLICT');
    await client.query('DELETE FROM invitations WHERE patient_id=$1 AND used_at IS NULL',[id]);
    await client.query(`INSERT INTO invitations(token_hash,email,patient_id,created_by,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '24 hours')`,[tokenHash(token),parsed.data.email,id,user.id]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'invite','patient',$2,$2)`,[user.id,id]);
  });
  return Response.json({invitationUrl:new URL('/invite/'+token,request.url).toString(),expiresInHours:24},{status:201,headers:noCache});
}catch(e){return failure(e)}}

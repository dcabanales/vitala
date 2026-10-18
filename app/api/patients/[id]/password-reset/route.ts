import {newOpaqueToken,tokenHash,verifyPassword} from '../../../../lib/auth';
import {requireUser,authorizePatient,failure,noCache,boundedRequest,problem} from '../../../../lib/server';
import {transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const input=z.object({password:z.string().min(1).max(256)}).strict();
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,4096),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const token=newOpaqueToken();
  const created=await transaction(async client=>{
    const account=await client.query('SELECT password_hash FROM users WHERE id=$1 AND status=$2',[user.id,'active']);
    if(!account.rowCount||!await verifyPassword(parsed.data.password,account.rows[0].password_hash))return false;
    const patient=await client.query('SELECT patient_user_id FROM patients WHERE id=$1 FOR UPDATE',[id]);
    if(!patient.rows[0]?.patient_user_id)throw new Error('CONFLICT');
    const userId=patient.rows[0].patient_user_id;
    await client.query('DELETE FROM password_resets WHERE user_id=$1 AND used_at IS NULL',[userId]);
    await client.query(`INSERT INTO password_resets(token_hash,user_id,expires_at)
      VALUES($1,$2,now()+interval '30 minutes')`,[tokenHash(token),userId]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'create_password_reset','user',$2,$3)`,[user.id,userId,id]);
    return true;
  });
  if(!created)return problem('Contraseña incorrecta.',403);
  return Response.json({resetUrl:new URL('/reset/'+token,request.url).toString(),expiresInMinutes:30},{headers:noCache});
}catch(e){return failure(e)}}

import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const revokeInput=z.object({userId:z.string().uuid()});
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id,true);
  const r=await query(`SELECT g.user_id AS "userId",u.email,g.access_level AS "accessLevel",g.authorized_by AS "authorizedBy",
    g.basis,g.created_at AS "createdAt",g.revoked_at AS "revokedAt" FROM patient_access_grants g
    JOIN users u ON u.id=g.user_id WHERE g.patient_id=$1 ORDER BY g.created_at`,[id]);
  return Response.json({grants:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function PATCH(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,4096),parsed=revokeInput.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  if(parsed.data.userId===user.id)throw new Error('ROLE');
  await transaction(async client=>{
    const r=await client.query(`UPDATE patient_access_grants SET revoked_at=now()
      WHERE patient_id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id`,[id,parsed.data.userId]);
    if(!r.rowCount)throw new Error('PATIENT');
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'revoke','access_grant',$2,$3)`,[user.id,r.rows[0].id,id]);
  });
  return Response.json({ok:true},{headers:noCache});
}catch(e){return failure(e)}}

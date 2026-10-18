import {requireUser,authorizePatient,failure,noCache} from '../../../../lib/server';
import {query} from '../../../../lib/db';
type Context={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Context){try{const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  await query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
    VALUES($1,'print','report',$2,$2)`,[user.id,id]);
  return Response.json({ok:true},{headers:noCache});
}catch(e){return failure(e)}}

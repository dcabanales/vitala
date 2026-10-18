import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../../lib/server';
import {transaction} from '../../../../../lib/db';
import {updateCareTask} from '../../../../../lib/care-task-schema';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string;taskId:string}>}){try{
 const user=await requireUser(request),{id,taskId}=await params;await authorizePatient(user,id,true);
 const req=await boundedRequest(request,12000),parsed=updateCareTask.safeParse(await req.json());if(!parsed.success)throw Error('VALIDATION');const p=parsed.data;
 const task=await transaction(async c=>{
  const old=(await c.query('SELECT * FROM care_tasks WHERE patient_id=$1 AND id=$2 FOR UPDATE',[id,taskId])).rows[0];if(!old)throw Error('PATIENT');if(old.consultation_id||old.examination_id)throw Error('TASK_COMPLETED');
  if(old.document_id&&old.kind!==p.kind)throw Error('TASK_KIND');
  if(old.version!==p.version)throw Error('CONFLICT');
  const result=await c.query(`UPDATE care_tasks SET kind=$3,title=$4,scheduled_date=$5,scheduled_time=$6,doctor_id=$7,center_id=$8,specialty_id=$9,notes=$10,status=$11,version=version+1,updated_at=now() WHERE patient_id=$1 AND id=$2 RETURNING id,version`,[id,taskId,p.kind,p.title,p.scheduledDate,p.scheduledTime,p.doctorId,p.centerId,p.specialtyId,p.notes,p.status]);
  await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'update','care_task',$2,$3)",[user.id,taskId,id]);return result.rows[0];
 });return Response.json({task},{headers:noCache});
}catch(e){return failure(e)}}

import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {createCareTask} from '../../../../lib/care-task-schema';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Context){try{
 const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
 const tasks=await query(`SELECT t.id,t.document_id AS "documentId",t.consultation_id AS "consultationId",t.examination_id AS "examinationId",EXISTS(SELECT 1 FROM medical_documents md WHERE md.id=t.document_id AND md.archived_at IS NULL AND md.status IN ('pending','ready')) AS "hasDocument",t.kind,t.title,t.scheduled_date AS "scheduledDate",to_char(t.scheduled_time,'HH24:MI') AS "scheduledTime",
 t.doctor_id AS "doctorId",t.center_id AS "centerId",t.specialty_id AS "specialtyId",d.name AS "doctorName",c.name AS "centerName",s.name AS "specialtyName",t.notes,t.status,t.version
 FROM care_tasks t LEFT JOIN doctors d ON d.id=t.doctor_id LEFT JOIN medical_centers c ON c.id=t.center_id LEFT JOIN medical_specialties s ON s.id=t.specialty_id
 WHERE t.patient_id=$1 ORDER BY (t.status='pending') DESC,t.scheduled_date ASC NULLS LAST,t.scheduled_time ASC NULLS LAST,t.created_at DESC`,[id]);
 return Response.json({tasks:tasks.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
 const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
 const req=await boundedRequest(request,12000),parsed=createCareTask.safeParse(await req.json());if(!parsed.success)throw Error('VALIDATION');const p=parsed.data;
 const task=await transaction(async c=>{
  const r=await c.query(`INSERT INTO care_tasks(patient_id,request_key,kind,title,scheduled_date,scheduled_time,doctor_id,center_id,specialty_id,notes,status,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(patient_id,request_key) DO NOTHING RETURNING id,version`,[id,p.requestKey,p.kind,p.title,p.scheduledDate,p.scheduledTime,p.doctorId,p.centerId,p.specialtyId,p.notes,p.status,user.id]);
  if(!r.rowCount)return (await c.query('SELECT id,version FROM care_tasks WHERE patient_id=$1 AND request_key=$2',[id,p.requestKey])).rows[0];
  await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','care_task',$2,$3)",[user.id,r.rows[0].id,id]);return r.rows[0];
 });return Response.json({task},{status:201,headers:noCache});
}catch(e){return failure(e)}}

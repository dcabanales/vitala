import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../../lib/server';
import {transaction} from '../../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string;examinationId:string}>};
const input=z.object({version:z.number().int().positive(),name:z.string().trim().min(1).max(200),
  doctorId:z.string().uuid().nullable().optional(),centerId:z.string().uuid().nullable().optional(),specialtyId:z.string().uuid().nullable().optional(),
  eventDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),indication:z.string().max(4000).nullable(),
  findings:z.string().max(8000).nullable(),conclusion:z.string().max(8000).nullable(),
  status:z.enum(['draft','published','void']),changeReason:z.string().trim().min(1).max(500)}).strict();
export async function PATCH(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id,examinationId}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,30_000),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const p=parsed.data;
  const result=await transaction(async client=>{
    const before=await client.query(`SELECT * FROM examinations WHERE patient_id=$1 AND id=$2 AND status<>'void' FOR UPDATE`,[id,examinationId]);
    const old=before.rows[0];if(!old)throw new Error('PATIENT');
    if(old.version!==p.version)throw new Error('CONFLICT');
    if(p.status==='draft'){
      const linked=await client.query(`SELECT 1 FROM measurements WHERE patient_id=$1 AND examination_id=$2 AND status='published' LIMIT 1`,
        [id,examinationId]);
      if(linked.rowCount)throw new Error('CONFLICT');
    }
    await client.query(`INSERT INTO examination_revisions(examination_id,patient_id,previous_version,snapshot,reason,changed_by)
      VALUES($1,$2,$3,$4,$5,$6)`,[examinationId,id,p.version,old,p.changeReason,user.id]);
    const updated=await client.query(`UPDATE examinations SET name=$3,event_date=$4,indication=$5,findings=$6,conclusion=$7,
      doctor_id=$10,center_id=$11,specialty_id=$12,doctor_as_documented=CASE WHEN $10::uuid IS NOT NULL THEN NULL ELSE doctor_as_documented END,center_as_documented=CASE WHEN $11::uuid IS NOT NULL THEN NULL ELSE center_as_documented END,specialty_as_documented=CASE WHEN $12::uuid IS NOT NULL THEN NULL ELSE specialty_as_documented END,status=$8,version=version+1,updated_at=now() WHERE patient_id=$1 AND id=$2 AND version=$9 RETURNING id,version,status`,
      [id,examinationId,p.name,p.eventDate,p.indication,p.findings,p.conclusion,p.status,p.version,p.doctorId===undefined?old.doctor_id:p.doctorId,p.centerId===undefined?old.center_id:p.centerId,p.specialtyId===undefined?old.specialty_id:p.specialtyId]);
    if(!updated.rowCount)throw new Error('CONFLICT');
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'update','examination',$2,$3)`,[user.id,examinationId,id]);
    return updated.rows[0];
  });
  return Response.json({examination:result},{headers:noCache});
}catch(e){return failure(e)}}

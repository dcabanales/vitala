import {completeCareTask} from '../../../../../../lib/complete-care-task';
import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../../../lib/server';
import {transaction} from '../../../../../../lib/db';
import {extractedConsultation,extractedExamination} from '../../../../../../lib/extraction';
import {z} from 'zod';
import {importConsultationRecords,resolveImportedMeasurementType} from '../../../../../../lib/import-consultation-records';
import {identityIssues} from '../../../../../../lib/document-identity';
type Context={params:Promise<{id:string;runId:string}>};
const identityReview={prescribingDoctorId:z.string().uuid().nullable().optional(),reviewVersion:z.number().int().positive().optional(),identityAcknowledgements:z.array(z.enum(['name','birthDate','identifier'])).default([]),identityReason:z.string().trim().max(1000).optional()};
const consultationInput=z.object({draft:extractedConsultation,...identityReview}).strict();
const examinationInput=z.object({draft:extractedExamination,...identityReview,measurementTypeIds:z.array(z.string().uuid().nullable()).max(150)}).strict();

export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id,runId}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,300_000),body:unknown=await req.json();
  const result=await transaction(async client=>{
    const runResult=await client.query(`SELECT r.*,p.name AS patient_name,p.birth_date AS patient_birth_date FROM extraction_runs r JOIN patients p ON p.id=r.patient_id
      WHERE r.id=$1 AND r.patient_id=$2 FOR UPDATE`,[runId,id]);
    const run=runResult.rows[0];if(!run)throw new Error('PATIENT');
    if(run.status==='confirmed')return {kind:run.purpose==='prescription'?'prescription':run.kind,id:run.kind==='examination'?run.examination_id:run.consultation_id,alreadyConfirmed:true};
    if(!(await client.query('SELECT 1 FROM medical_documents WHERE patient_id=$1 AND id=$2 AND archived_at IS NULL FOR SHARE',[id,run.document_id])).rowCount)throw Error('PATIENT');
    if(run.status!=='review'||!run.draft||!['consultation','examination'].includes(run.kind))throw new Error('CONFLICT');
    const review=z.object(identityReview).safeParse(body);if(!review.success)throw new Error('VALIDATION');
    if(review.data.reviewVersion&&review.data.reviewVersion!==run.review_version)throw Error('CONFLICT');
    const issues=identityIssues(run.original_draft||run.draft,{name:run.patient_name,birthDate:run.patient_birth_date});
    if(issues.length&&issues.some(issue=>!review.data.identityAcknowledgements.includes(issue.field)))throw new Error('IDENTITY_REVIEW');
    if(issues.length){
      await client.query('UPDATE extraction_runs SET identity_review=$2 WHERE id=$1',[runId,{issues,reason:review.data.identityReason||null,acknowledgements:review.data.identityAcknowledgements,reviewedBy:user.id,reviewedAt:new Date().toISOString()}]);
      await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'confirm_document_identity','extraction',$2,$3)`,[user.id,runId,id]);
    }

    if(run.kind==='consultation'){
      const parsed=consultationInput.safeParse(body);if(!parsed.success)throw new Error('VALIDATION');
      if(run.purpose==='prescription'){
        if((await client.query('SELECT 1 FROM care_tasks WHERE patient_id=$1 AND document_id=$2',[id,run.document_id])).rowCount)throw Error('TASK_KIND');
        const p=parsed.data.draft;
        if(!p.clinicalRecords?.some(r=>r.kind==='medication'||r.kind==='treatment'))throw Error('PRESCRIPTION_EMPTY');
        let doctorId=parsed.data.prescribingDoctorId||null;
        if(doctorId&&!(await client.query('SELECT 1 FROM doctors WHERE id=$1 AND active',[doctorId])).rowCount)throw Error('VALIDATION');
        if(!doctorId&&p.doctorName){const match=await client.query('SELECT id FROM doctors WHERE lower(name)=lower($1) AND active LIMIT 2',[p.doctorName]);if(match.rowCount===1)doctorId=match.rows[0].id}
        const imported=await importConsultationRecords(client,{patientId:id,consultationId:null,documentId:run.document_id,actorId:user.id,date:p.eventDate,records:p.clinicalRecords,doctorId,doctorName:p.doctorName});
        await client.query("UPDATE extraction_runs SET status='confirmed',reviewed_by=$2,draft=$3,finished_at=now() WHERE id=$1",[runId,user.id,p]);
        await client.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'confirm_prescription','document',$2,$3)",[user.id,run.document_id,id]);
        return {kind:'prescription',id:run.document_id,alreadyConfirmed:false,imported};
      }
      const previous=await client.query('SELECT consultation_id FROM consultation_documents WHERE patient_id=$1 AND document_id=$2',[id,run.document_id]);
      if(previous.rowCount&&previous.rows[0].consultation_id!==run.consultation_id)throw new Error('CONFLICT');
      const p=parsed.data.draft;
      const doctor=await client.query('SELECT id FROM doctors WHERE lower(name)=lower($1) AND active LIMIT 2',[p.doctorName||'']);
      const center=await client.query('SELECT id FROM medical_centers WHERE lower(name)=lower($1) AND active LIMIT 2',[p.centerName||'']);
      const specialty=await client.query('SELECT id FROM medical_specialties WHERE lower(name)=lower($1) AND active LIMIT 2',[p.specialtyName||'']);
      let consultationId=run.consultation_id as string|null;
      if(consultationId){if(!(await client.query("SELECT 1 FROM consultations WHERE patient_id=$1 AND id=$2 AND status='published' FOR UPDATE",[id,consultationId])).rowCount)throw Error('CONFLICT')}else{
      const r=await client.query(`INSERT INTO consultations(patient_id,event_date,doctor_id,center_id,specialty_id,doctor_as_documented,
        center_as_documented,specialty_as_documented,reason,symptoms,summary,findings,impression,conclusion,recommendations,follow_up,status,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'published',$17) RETURNING id`,
        [id,p.eventDate,doctor.rowCount===1?doctor.rows[0].id:null,center.rowCount===1?center.rows[0].id:null,
         specialty.rowCount===1?specialty.rows[0].id:null,p.doctorName,p.centerName,p.specialtyName,p.reason,p.symptoms,p.summary,p.findings,
         p.impression,p.conclusion,p.recommendations,p.followUp,user.id]);
      consultationId=r.rows[0].id;
      await client.query('INSERT INTO consultation_documents(patient_id,consultation_id,document_id) VALUES($1,$2,$3)',[id,consultationId,run.document_id]);
      }
      const imported=await importConsultationRecords(client,{patientId:id,consultationId:consultationId!,documentId:run.document_id,actorId:user.id,date:p.eventDate,records:p.clinicalRecords||[]});
      await completeCareTask(client,id,run.document_id,'consultation',consultationId!,user.id);
      await client.query(`UPDATE extraction_runs SET status='confirmed',reviewed_by=$2,consultation_id=$3,draft=$4,finished_at=now() WHERE id=$1`,
        [runId,user.id,consultationId,p]);
      await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
        VALUES($1,'confirm_extraction','consultation',$2,$3)`,[user.id,consultationId,id]);
      return {kind:'consultation',id:consultationId,alreadyConfirmed:false,imported};
    }

    const parsed=examinationInput.safeParse(body);if(!parsed.success)throw new Error('VALIDATION');
    const p=parsed.data.draft,selected=parsed.data.measurementTypeIds;
    if(!p.name?.trim()||selected.length!==p.measurements.length)throw new Error('VALIDATION');
    const previous=await client.query('SELECT examination_id FROM examination_documents WHERE patient_id=$1 AND document_id=$2',[id,run.document_id]);
    if(previous.rowCount&&previous.rows[0].examination_id!==run.examination_id)throw new Error('CONFLICT');
    const doctor=await client.query('SELECT id FROM doctors WHERE lower(name)=lower($1) AND active LIMIT 2',[p.doctorName||'']);
    const center=await client.query('SELECT id FROM medical_centers WHERE lower(name)=lower($1) AND active LIMIT 2',[p.centerName||'']);
    const specialty=await client.query('SELECT id FROM medical_specialties WHERE lower(name)=lower($1) AND active LIMIT 2',[p.specialtyName||'']);
    const findings=p.findings;
    let examinationId=run.examination_id as string|null;
    if(examinationId){if(!(await client.query("SELECT 1 FROM examinations WHERE patient_id=$1 AND id=$2 AND status='published' FOR UPDATE",[id,examinationId])).rowCount)throw Error('CONFLICT')}else{
    const exam=await client.query(`INSERT INTO examinations(patient_id,name,event_date,specialty_id,doctor_id,center_id,
      specialty_as_documented,doctor_as_documented,center_as_documented,indication,findings,conclusion,status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'published',$13) RETURNING id`,
      [id,p.name,p.eventDate,specialty.rowCount===1?specialty.rows[0].id:null,doctor.rowCount===1?doctor.rows[0].id:null,
       center.rowCount===1?center.rows[0].id:null,p.specialtyName,p.doctorName,p.centerName,p.indication,findings,p.conclusion,user.id]);
    examinationId=exam.rows[0].id;
    await client.query('INSERT INTO examination_documents(patient_id,examination_id,document_id) VALUES($1,$2,$3)',[id,examinationId,run.document_id]);
    }
    for(let index=0;index<selected.length;index++){
      const m=p.measurements[index],kind=m.numericValue!==null?'number':'text';
      const typeId=selected[index]||await resolveImportedMeasurementType(client,m.typeName,kind);
      if(run.examination_id&&(await client.query("SELECT 1 FROM measurements WHERE patient_id=$1 AND examination_id=$2 AND document_id=$3 AND lower(name_as_documented)=lower($4)",[id,examinationId,run.document_id,m.typeName])).rowCount)continue;
      const t=await client.query('SELECT value_kind FROM measurement_types WHERE id=$1 AND active FOR SHARE',[typeId]);
      if(t.rows[0]?.value_kind!==kind)throw new Error('VALIDATION');
      await client.query(`INSERT INTO measurements(patient_id,type_id,examination_id,document_id,documented_date,value_kind,
        numeric_value,text_value,original_value,unit,reference_range,status,created_by,name_as_documented)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published',$12,$13)`,
        [id,typeId,examinationId,run.document_id,p.eventDate,kind,m.numericValue,kind==='text'?m.originalValue:null,m.originalValue,m.unit,m.referenceRange,user.id,m.typeName]);
    }
    await importConsultationRecords(client,{patientId:id,consultationId:null,examinationId:examinationId!,documentId:run.document_id,actorId:user.id,date:p.eventDate,records:p.clinicalRecords||[]});
    await completeCareTask(client,id,run.document_id,'examination',examinationId!,user.id);
    await client.query(`UPDATE extraction_runs SET status='confirmed',reviewed_by=$2,examination_id=$3,draft=$4,finished_at=now() WHERE id=$1`,
      [runId,user.id,examinationId,p]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'confirm_extraction','examination',$2,$3)`,[user.id,examinationId,id]);
    return {kind:'examination',id:examinationId,alreadyConfirmed:false};
  });
  return Response.json(result.kind==='prescription'?{prescription:result}:result.kind==='examination'?{examination:result}:{consultation:result},{headers:noCache});
}catch(e){return failure(e)}}

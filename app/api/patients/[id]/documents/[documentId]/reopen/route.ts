import {requireUser,authorizePatient,failure,noCache} from '../../../../../../lib/server';
import {transaction} from '../../../../../../lib/db';
export async function POST(req:Request,{params}:{params:Promise<{id:string;documentId:string}>}){try{
 const user=await requireUser(req),{id,documentId}=await params;await authorizePatient(user,id,true);
 const runId=await transaction(async c=>{
  if(!(await c.query("SELECT 1 FROM medical_documents WHERE patient_id=$1 AND id=$2 AND archived_at IS NULL AND status='ready' FOR UPDATE",[id,documentId])).rowCount)throw Error('PATIENT');
  if((await c.query("SELECT 1 FROM extraction_runs WHERE patient_id=$1 AND document_id=$2 AND status='running' AND created_at>now()-interval '3 minutes'",[id,documentId])).rowCount)throw Error('AI_DOCUMENT_BUSY');
  const previous=(await c.query("SELECT * FROM extraction_runs WHERE patient_id=$1 AND document_id=$2 AND status='confirmed' AND draft IS NOT NULL ORDER BY created_at DESC LIMIT 1",[id,documentId])).rows[0];if(!previous)throw Error('CONFLICT');
  const review=(await c.query("SELECT id FROM extraction_runs WHERE patient_id=$1 AND document_id=$2 AND status='review' AND created_at>$3 AND kind=$4 AND purpose=$5 ORDER BY created_at DESC LIMIT 1",[id,documentId,previous.created_at,previous.kind,previous.purpose])).rows[0];if(review)return review.id;
  const result=(await c.query("INSERT INTO extraction_runs(patient_id,document_id,kind,purpose,status,model,schema_version,draft,original_draft,measurement_type_ids,created_by,consultation_id,examination_id,finished_at) VALUES($1,$2,$3,$4,'review',$5,$6,$7,$8,$9,$10,$11,$12,now()) RETURNING id",[id,documentId,previous.kind,previous.purpose,previous.model,previous.schema_version,previous.draft,previous.original_draft||previous.draft,previous.measurement_type_ids===null?null:JSON.stringify(previous.measurement_type_ids),user.id,previous.consultation_id,previous.examination_id])).rows[0];
  await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'reopen_saved_extraction','document',$2,$3)",[user.id,documentId,id]);return result.id;
 });return Response.json({runId},{headers:noCache});
}catch(e){return failure(e)}}

import {requireUser,authorizePatient,failure,noCache} from '../../../../../../lib/server';
import {transaction,query} from '../../../../../../lib/db';
import {examinationFingerprint,interpretExamination} from '../../../../../../lib/examination-interpretation';
export async function POST(req:Request,{params}:{params:Promise<{id:string;examinationId:string}>}){let runId:string|undefined;try{
 const user=await requireUser(req),{id,examinationId}=await params;await authorizePatient(user,id,true);
 if(!process.env.OPENAI_API_KEY)throw Error('AI_CONFIG');
 const model=process.env.OPENAI_MODEL||'gpt-6-luna';
 const source=await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(742511,2)');
  const exam=(await c.query("SELECT * FROM examinations WHERE patient_id=$1 AND id=$2 AND status<>'void'",[id,examinationId])).rows[0];if(!exam)throw Error('PATIENT');
  const measures=(await c.query(`SELECT m.*,t.name AS type_name FROM measurements m JOIN measurement_types t ON t.id=m.type_id WHERE m.patient_id=$1 AND m.examination_id=$2 AND m.status='published' ORDER BY m.id`,[id,examinationId])).rows;
  if(!measures.length&&!exam.findings&&!exam.conclusion)throw Error('VALIDATION');
  const hash=examinationFingerprint(exam,measures);
  const existing=(await c.query("SELECT content FROM examination_interpretations WHERE examination_id=$1 AND source_hash=$2 AND status='completed' ORDER BY created_at DESC LIMIT 1",[examinationId,hash])).rows[0];
  if(existing)return {exam,measures,hash,cached:true};
  await c.query("UPDATE examination_interpretations SET status='failed' WHERE status='running' AND created_at<now()-interval '3 minutes'");
  const count=(await c.query("SELECT count(*) FILTER(WHERE status='running')::int AS running FROM examination_interpretations")).rows[0];
  if(count.running>=2)throw Error('AI_BUSY');
  if((await c.query("SELECT 1 FROM examination_interpretations WHERE examination_id=$1 AND status='running'",[examinationId])).rowCount)throw Error('AI_BUSY');
  runId=(await c.query("INSERT INTO examination_interpretations(patient_id,examination_id,source_hash,model,status,created_by) VALUES($1,$2,$3,$4,'running',$5) RETURNING id",[id,examinationId,hash,model,user.id])).rows[0].id;
  return {exam,measures,hash,cached:false};
 });
 if(source.cached)return Response.json({ok:true,cached:true},{headers:noCache});
 const content=await interpretExamination(source.exam,source.measures,model);
 await query("UPDATE examination_interpretations SET status='completed',content=$2 WHERE id=$1",[runId,content]);
 await query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'generate_ai_interpretation','examination',$2,$3)",[user.id,examinationId,id]);
 return Response.json({ok:true},{headers:noCache});
}catch(e){if(runId)await query("UPDATE examination_interpretations SET status='failed' WHERE id=$1",[runId]);return failure(e)}}

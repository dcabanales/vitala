import {requireUser,authorizePatient,failure,noCache} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {patientSummarySource,summaryFingerprint} from '../../../../lib/patient-summary-data';
import {generatePatientSummary} from '../../../../lib/generate-patient-summary';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){let runId:string|undefined;try{
 const user=await requireUser(req),{id}=await params;await authorizePatient(user,id,true);
 const source=await patientSummarySource(id),hash=summaryFingerprint(source);
 if(!Object.entries(source).some(([k,rows])=>k!=='profile'&&rows.length))throw Error('SUMMARY_EMPTY');
 const reservation=await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(742511,3)');
  const cached=(await c.query("SELECT content FROM patient_summaries WHERE patient_id=$1 AND source_hash=$2 AND status='completed' ORDER BY created_at DESC LIMIT 1",[id,hash])).rows[0];
  if(cached)return {cached:true};
  if(!process.env.OPENAI_API_KEY)throw Error('AI_CONFIG');
  await c.query("UPDATE patient_summaries SET status='failed',finished_at=now() WHERE status='running' AND created_at<now()-interval '3 minutes'");
  if((await c.query("SELECT 1 FROM patient_summaries WHERE patient_id=$1 AND status='running'",[id])).rowCount)throw Error('SUMMARY_BUSY');
  const count=(await c.query("SELECT count(*) FILTER(WHERE status='running')::int AS running FROM patient_summaries")).rows[0];
  if(count.running>=2)throw Error('SUMMARY_BUSY');
  runId=(await c.query("INSERT INTO patient_summaries(patient_id,source_hash,model,status,created_by) VALUES($1,$2,$3,'running',$4) RETURNING id",[id,hash,process.env.OPENAI_MODEL||'gpt-6-luna',user.id])).rows[0].id;
  return {cached:false};
 });
 if(reservation.cached)return Response.json({cached:true},{headers:noCache});
 const content=await generatePatientSummary(source,process.env.OPENAI_MODEL||'gpt-6-luna');
 await transaction(async c=>{
  await c.query("UPDATE patient_summaries SET status='completed',content=$2,finished_at=now() WHERE id=$1 AND status='running'",[runId,content]);
  await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'generate_summary','patient_summary',$2,$3)",[user.id,runId,id]);
 });
 return Response.json({cached:false},{headers:noCache});
}catch(e){if(runId)await query("UPDATE patient_summaries SET status='failed',finished_at=now() WHERE id=$1 AND status='running'",[runId]);return failure(e)}}

import {requireUser,authorizePatient,boundedRequest,failure,noCache,problem} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {patientSummarySource} from '../../../../lib/patient-summary-data';
import {askPatientAssistant} from '../../../../lib/patient-assistant';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){let runId:string|undefined;try{
 const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
 const body=await (await boundedRequest(req,6000)).json();if(typeof body.question!=='string'||!body.question.trim()||body.question.length>1200)return problem('Escribe una pregunta de hasta 1200 caracteres.',400);
 if(!process.env.OPENAI_API_KEY)throw Error('AI_CONFIG');
 const source=await patientSummarySource(id);if(JSON.stringify(source).length>175000)throw Error('SUMMARY_SIZE');
 await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(742511,5)');
  await c.query("UPDATE assistant_requests SET status='failed',finished_at=now() WHERE status='running' AND created_at<now()-interval '3 minutes'");
  const counts=(await c.query("SELECT count(*) FILTER(WHERE user_id=$1 AND created_at>now()-interval '24 hours')::int AS daily,count(*) FILTER(WHERE created_at>now()-interval '24 hours')::int AS global_daily,count(*) FILTER(WHERE status='running')::int AS running FROM assistant_requests",[user.id])).rows[0];
  if(counts.daily>=10||counts.global_daily>=50)return Promise.reject(Error('AI_BUDGET'));if(counts.running>=2)throw Error('AI_BUSY');
  runId=(await c.query("INSERT INTO assistant_requests(patient_id,user_id,status) VALUES($1,$2,'running') RETURNING id",[id,user.id])).rows[0].id;
 });
 const answer=await askPatientAssistant(body.question.trim(),source);await authorizePatient(user,id);
 await query("UPDATE assistant_requests SET status='completed',finished_at=now() WHERE id=$1",[runId]);return Response.json(answer,{headers:noCache});
 }catch(e){if(runId)await query("UPDATE assistant_requests SET status='failed',finished_at=now() WHERE id=$1",[runId]);if(e instanceof SyntaxError)return problem('Solicitud no válida.',400);return failure(e)}
}

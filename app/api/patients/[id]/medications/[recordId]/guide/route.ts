import {requireUser,authorizePatient,failure,noCache} from '../../../../../../lib/server';
import {query,transaction} from '../../../../../../lib/db';
import {explainMedication,medicationGuideHash} from '../../../../../../lib/medication-guide';
type Context={params:Promise<{id:string;recordId:string}>};
async function source(req:Request,params:Context['params'],write=false){
 const user=await requireUser(req),{id,recordId}=await params;await authorizePatient(user,id,write);
 const med=(await query<{id:string;name:string;ingredient:string|null}>(`SELECT m.id,m.name,m.active_ingredient AS ingredient FROM patient_medications pm JOIN medications m ON m.id=pm.medication_id WHERE pm.patient_id=$1 AND pm.id=$2 AND pm.status<>'void' AND ($3='admin' OR pm.status='published')`,[id,recordId,user.role])).rows[0];if(!med)throw Error('PATIENT');return {user,med};
}
export async function GET(req:Request,{params}:Context){try{
 const {med}=await source(req,params);const guide=(await query("SELECT content,created_at FROM medication_guides WHERE medication_id=$1 AND source_hash=$2 AND status='completed' ORDER BY created_at DESC LIMIT 1",[med.id,medicationGuideHash(med.name,med.ingredient)])).rows[0]||null;
 return Response.json({guide},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(req:Request,{params}:Context){let runId:string|undefined;try{
 const {user,med}=await source(req,params,true),hash=medicationGuideHash(med.name,med.ingredient),model=process.env.OPENAI_MODEL||'gpt-6-luna';
 const cached=await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(742511,4)');
  const saved=(await c.query("SELECT content,created_at FROM medication_guides WHERE medication_id=$1 AND source_hash=$2 AND status='completed' ORDER BY created_at DESC LIMIT 1",[med.id,hash])).rows[0];if(saved)return saved;
  if(!process.env.OPENAI_API_KEY)throw Error('AI_CONFIG');
  await c.query("UPDATE medication_guides SET status='failed',finished_at=now() WHERE status='running' AND created_at<now()-interval '3 minutes'");
  if((await c.query("SELECT 1 FROM medication_guides WHERE medication_id=$1 AND status='running'",[med.id])).rowCount)throw Error('GUIDE_BUSY');
  const count=(await c.query("SELECT count(*) FILTER(WHERE status='running')::int AS running FROM medication_guides")).rows[0];
  if(count.running>=2)throw Error('GUIDE_BUSY');
  runId=(await c.query("INSERT INTO medication_guides(medication_id,source_hash,model,status,created_by) VALUES($1,$2,$3,'running',$4) RETURNING id",[med.id,hash,model,user.id])).rows[0].id;return null;
 });
 if(cached)return Response.json({guide:cached,cached:true},{headers:noCache});
 const content=await explainMedication(med.name,med.ingredient,model);
 const saved=(await query("UPDATE medication_guides SET status='completed',content=$2,finished_at=now() WHERE id=$1 RETURNING content,created_at",[runId,content])).rows[0];
 return Response.json({guide:saved,cached:false},{headers:noCache});
}catch(e){if(runId)await query("UPDATE medication_guides SET status='failed',finished_at=now() WHERE id=$1 AND status='running'",[runId]);return failure(e)}}

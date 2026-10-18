import {z} from 'zod';
import {requireUser,authorizePatient,boundedRequest,failure,noCache} from '../../../../lib/server';
import {transaction} from '../../../../lib/db';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await requireUser(req),{id}=await params;await authorizePatient(user,id,user.role==='admin');
 const parsed=z.object({kind:z.enum(['treatment','medication']),recordId:z.string().uuid(),state:z.enum(['followed','not_followed','unknown'])}).strict().safeParse(await (await boundedRequest(req,2048)).json());if(!parsed.success)throw Error('VALIDATION');const p=parsed.data;
 await transaction(async c=>{
  const table=p.kind==='treatment'?'treatments':'patient_medications';
  const record=(await c.query(`SELECT id FROM ${table} WHERE patient_id=$1 AND id=$2 AND status<>'void' AND ($3='admin' OR status='published') FOR UPDATE`,[id,p.recordId,user.role])).rows[0];if(!record)throw Error('PATIENT');
  await c.query('INSERT INTO care_followup(patient_id,kind,resource_id,state,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(patient_id,kind,resource_id) DO UPDATE SET state=EXCLUDED.state,updated_by=EXCLUDED.updated_by,updated_at=now()',[id,p.kind,p.recordId,p.state,user.id]);
  await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,$2,$3,$4,$5)",[user.id,'care_'+p.state,p.kind,p.recordId,id]);
 });return Response.json({ok:true,state:p.state},{headers:noCache});
}catch(e){return failure(e)}}

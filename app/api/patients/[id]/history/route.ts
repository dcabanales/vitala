import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const input=z.object({kind:z.enum(['surgery','hospitalization','personal','family','other']),title:z.string().trim().min(1).max(200),detail:z.string().max(4000).nullish(),documentedDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),familyRelation:z.string().max(120).nullish(),documentId:z.string().uuid().nullish(),status:z.enum(['draft','published']).default('published')}).strict();
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT id,version,kind,title,detail,documented_date AS "documentedDate",family_relation AS "familyRelation",document_id AS "documentId",status
    FROM medical_history_events WHERE patient_id=$1 AND status<>'void' AND ($2='admin' OR status='published') ORDER BY documented_date DESC NULLS LAST,created_at DESC`,[id,user.role]);
  return Response.json({history:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,12_000),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  const row=await transaction(async client=>{
    const r=await client.query(`INSERT INTO medical_history_events(patient_id,kind,title,detail,documented_date,family_relation,document_id,status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[id,p.kind,p.title,p.detail||null,p.documentedDate||null,p.familyRelation||null,p.documentId||null,p.status,user.id]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','history_event',$2,$3)`,[user.id,r.rows[0].id,id]);return r.rows[0];
  });return Response.json({event:row},{status:201,headers:noCache});
}catch(e){return failure(e)}}

export async function PATCH(request:Request,{params}:Context){try{
 const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
 const req=await boundedRequest(request,16_000);
 const parsed=input.partial().extend({status:z.enum(['draft','published','void']).optional(),id:z.string().uuid(),version:z.number().int().positive(),changeReason:z.string().trim().min(1).max(500)}).strict().safeParse(await req.json());
 if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
 const map:Record<string,string>={"kind": "kind", "title": "title", "detail": "detail", "documentedDate": "documented_date", "familyRelation": "family_relation", "documentId": "document_id", "status": "status"};
 const result=await transaction(async client=>{
  const old=(await client.query("SELECT * FROM medical_history_events WHERE patient_id=$1 AND id=$2 AND status<>'void' FOR UPDATE",[id,p.id])).rows[0];
  if(!old)throw new Error('PATIENT');if(old.version!==p.version)throw new Error('CONFLICT');
  const values:unknown[]=[id,p.id,p.version],sets:string[]=[];
  for(const [key,column] of Object.entries(map)){if(Object.hasOwn(p,key)){values.push((p as Record<string,unknown>)[key]??null);sets.push(`${column}=$${values.length}`)}}
  if(!sets.length)throw new Error('VALIDATION');
  await client.query(`INSERT INTO clinical_fact_revisions(patient_id,resource_type,resource_id,previous_version,snapshot,reason,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,"history_event",p.id,p.version,old,p.changeReason,user.id]);
  const updated=await client.query(`UPDATE medical_history_events SET ${sets.join(',')},version=version+1 WHERE patient_id=$1 AND id=$2 AND version=$3 RETURNING id,version`,values);
  if(!updated.rowCount)throw new Error('CONFLICT');
  await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'update',$2,$3,$4)`,[user.id,"history_event",p.id,id]);
  return updated.rows[0];
 });return Response.json({item:result},{headers:noCache});
}catch(e){return failure(e)}}

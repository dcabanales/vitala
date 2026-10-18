import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const input=z.object({substance:z.string().trim().min(1).max(180),kind:z.enum(['allergy','intolerance']).default('allergy'),reaction:z.string().max(2000).nullish(),severity:z.string().max(120).nullish(),state:z.enum(['active','resolved','unknown']).default('unknown'),documentedDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),sourceNote:z.string().max(500).nullish(),documentId:z.string().uuid().nullish(),status:z.enum(['draft','published']).default('published')}).strict();
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT id,version,substance,kind,reaction,severity,state,documented_date AS "documentedDate",source_note AS "sourceNote",document_id AS "documentId",status
    FROM allergies WHERE patient_id=$1 AND status<>'void' AND ($2='admin' OR status='published') ORDER BY documented_date DESC NULLS LAST,substance`,[id,user.role]);
  return Response.json({allergies:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,12_000),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  const row=await transaction(async client=>{
    const r=await client.query(`INSERT INTO allergies(patient_id,substance,kind,reaction,severity,state,documented_date,source_note,document_id,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[id,p.substance,p.kind,p.reaction||null,p.severity||null,p.state,p.documentedDate||null,p.sourceNote||null,p.documentId||null,p.status]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','allergy',$2,$3)`,[user.id,r.rows[0].id,id]);return r.rows[0];
  });return Response.json({allergy:row},{status:201,headers:noCache});
}catch(e){return failure(e)}}

export async function PATCH(request:Request,{params}:Context){try{
 const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
 const req=await boundedRequest(request,16_000);
 const parsed=input.partial().extend({id:z.string().uuid(),version:z.number().int().positive(),changeReason:z.string().trim().min(1).max(500)}).strict().safeParse(await req.json());
 if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
 const map:Record<string,string>={"substance": "substance", "kind": "kind", "reaction": "reaction", "severity": "severity", "state": "state", "documentedDate": "documented_date", "sourceNote": "source_note", "documentId": "document_id", "status": "status"};
 const result=await transaction(async client=>{
  const old=(await client.query("SELECT * FROM allergies WHERE patient_id=$1 AND id=$2 AND status<>'void' FOR UPDATE",[id,p.id])).rows[0];
  if(!old)throw new Error('PATIENT');if(old.version!==p.version)throw new Error('CONFLICT');
  const values:unknown[]=[id,p.id,p.version],sets:string[]=[];
  for(const [key,column] of Object.entries(map)){if(Object.hasOwn(p,key)){values.push((p as Record<string,unknown>)[key]??null);sets.push(`${column}=$${values.length}`)}}
  if(!sets.length)throw new Error('VALIDATION');
  await client.query(`INSERT INTO clinical_fact_revisions(patient_id,resource_type,resource_id,previous_version,snapshot,reason,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,"allergy",p.id,p.version,old,p.changeReason,user.id]);
  const updated=await client.query(`UPDATE allergies SET ${sets.join(',')},version=version+1 WHERE patient_id=$1 AND id=$2 AND version=$3 RETURNING id,version`,values);
  if(!updated.rowCount)throw new Error('CONFLICT');
  await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'update',$2,$3,$4)`,[user.id,"allergy",p.id,id]);
  return updated.rows[0];
 });return Response.json({item:result},{headers:noCache});
}catch(e){return failure(e)}}

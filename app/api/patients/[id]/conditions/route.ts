import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const input=z.object({conditionId:z.string().uuid(),state:z.enum(['active','resolved','historical','unknown']).default('unknown'),certainty:z.enum(['confirmed','suspected','unknown']).default('unknown'),documentedDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),note:z.string().max(4000).nullish(),sourceNote:z.string().max(500).nullish(),documentId:z.string().uuid().nullish(),status:z.enum(['draft','published']).default('published')}).strict();
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT pc.id,pc.condition_id AS "conditionId",pc.version,mc.name,pc.state,pc.certainty,pc.documented_date AS "documentedDate",pc.note,pc.source_note AS "sourceNote",pc.document_id AS "documentId",pc.status
    FROM patient_conditions pc JOIN medical_conditions mc ON mc.id=pc.condition_id
    WHERE pc.patient_id=$1 AND pc.status<>'void' AND ($2='admin' OR pc.status='published') ORDER BY pc.documented_date DESC NULLS LAST,mc.name`,[id,user.role]);
  return Response.json({conditions:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,12_000),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  const row=await transaction(async client=>{
    const r=await client.query(`INSERT INTO patient_conditions(patient_id,condition_id,state,certainty,documented_date,note,source_note,document_id,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[id,p.conditionId,p.state,p.certainty,p.documentedDate||null,p.note||null,p.sourceNote||null,p.documentId||null,p.status]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','condition',$2,$3)`,[user.id,r.rows[0].id,id]);return r.rows[0];
  });return Response.json({condition:row},{status:201,headers:noCache});
}catch(e){return failure(e)}}

export async function PATCH(request:Request,{params}:Context){try{
 const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
 const req=await boundedRequest(request,16_000);
 const parsed=input.partial().extend({id:z.string().uuid(),version:z.number().int().positive(),changeReason:z.string().trim().min(1).max(500)}).strict().safeParse(await req.json());
 if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
 const map:Record<string,string>={"conditionId": "condition_id", "state": "state", "certainty": "certainty", "documentedDate": "documented_date", "note": "note", "sourceNote": "source_note", "documentId": "document_id", "status": "status"};
 const result=await transaction(async client=>{
  const old=(await client.query("SELECT * FROM patient_conditions WHERE patient_id=$1 AND id=$2 AND status<>'void' FOR UPDATE",[id,p.id])).rows[0];
  if(!old)throw new Error('PATIENT');if(old.version!==p.version)throw new Error('CONFLICT');
  const values:unknown[]=[id,p.id,p.version],sets:string[]=[];
  for(const [key,column] of Object.entries(map)){if(Object.hasOwn(p,key)){values.push((p as Record<string,unknown>)[key]??null);sets.push(`${column}=$${values.length}`)}}
  if(!sets.length)throw new Error('VALIDATION');
  await client.query(`INSERT INTO clinical_fact_revisions(patient_id,resource_type,resource_id,previous_version,snapshot,reason,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,"condition",p.id,p.version,old,p.changeReason,user.id]);
  const updated=await client.query(`UPDATE patient_conditions SET ${sets.join(',')},version=version+1 WHERE patient_id=$1 AND id=$2 AND version=$3 RETURNING id,version`,values);
  if(!updated.rowCount)throw new Error('CONFLICT');
  await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'update',$2,$3,$4)`,[user.id,"condition",p.id,id]);
  return updated.rows[0];
 });return Response.json({item:result},{headers:noCache});
}catch(e){return failure(e)}}

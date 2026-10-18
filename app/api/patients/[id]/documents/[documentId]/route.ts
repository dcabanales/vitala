import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../../lib/server';
import {query,transaction} from '../../../../../lib/db';
import {getObject} from '../../../../../lib/objects';
import {z} from 'zod';
type Context={params:Promise<{id:string;documentId:string}>};
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id,documentId}=await params;await authorizePatient(user,id);
  const r=await query<{file_name:string;mime_type:string;object_key:string}>(`SELECT file_name,mime_type,object_key FROM medical_documents
    WHERE patient_id=$1 AND id=$2 AND status='ready' AND ($3='admin' OR visible_to_patient)`,[id,documentId,user.role]);
  const doc=r.rows[0];if(!doc)throw new Error('PATIENT');
  const bytes=await getObject(doc.object_key),body=new Uint8Array(bytes.length);body.set(bytes);
  await query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
    VALUES($1,'download','document',$2,$3)`,[user.id,documentId,id]);
  return new Response(body,{headers:{...noCache,'Content-Type':doc.mime_type,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
    'Content-Security-Policy':'sandbox','X-Content-Type-Options':'nosniff'}});
}catch(e){return failure(e)}}
export async function PATCH(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id,documentId}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,4096),parsed=z.object({visibleToPatient:z.boolean()}).strict().safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const row=await transaction(async client=>{
    const r=await client.query(`UPDATE medical_documents SET visible_to_patient=$3,updated_at=now()
      WHERE patient_id=$1 AND id=$2 AND status='ready' RETURNING id`,[id,documentId,parsed.data.visibleToPatient]);
    if(!r.rowCount)throw new Error('PATIENT');
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'publish','document',$2,$3)`,[user.id,documentId,id]);return r.rows[0];
  });return Response.json({document:row},{headers:noCache});
}catch(e){return failure(e)}}

// Removing from the library preserves original sources and can be undone.
export async function DELETE(request:Request,context:Context){return archive(request,context,true)}
export async function POST(request:Request,context:Context){return archive(request,context,false)}
async function archive(request:Request,{params}:Context,removed:boolean){try{
 const user=await requireUser(request),{id,documentId}=await params;await authorizePatient(user,id,user.role==='admin');
 await transaction(async client=>{
  const doc=(await client.query('SELECT created_by,status FROM medical_documents WHERE patient_id=$1 AND id=$2 FOR UPDATE',[id,documentId])).rows[0];
  if(!doc||(user.role!=='admin'&&doc.created_by!==user.id))throw Error('PATIENT');
  await client.query("UPDATE extraction_runs SET status='interrupted',finished_at=now(),error_code='INTERRUPTED' WHERE patient_id=$1 AND document_id=$2 AND status='running' AND created_at<now()-interval '3 minutes'",[id,documentId]);
  if((await client.query("SELECT 1 FROM extraction_runs WHERE patient_id=$1 AND document_id=$2 AND status='running'",[id,documentId])).rowCount)throw Error('DOCUMENT_BUSY');
  await client.query('UPDATE medical_documents SET archived_at=CASE WHEN $3 THEN now() ELSE NULL END,updated_at=now() WHERE patient_id=$1 AND id=$2',[id,documentId,removed]);
  await client.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,$2,'document',$3,$4)",[user.id,removed?'archive':'restore',documentId,id]);
 });return Response.json({removed},{headers:noCache});
}catch(e){return failure(e)}}

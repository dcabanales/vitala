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

import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {putObject} from '../../../../lib/objects';
import {createHash,randomUUID} from 'node:crypto';
type Context={params:Promise<{id:string}>};
const types=['application/pdf','image/jpeg','image/png','image/webp'];
function validSignature(type:string,bytes:Uint8Array){
  const text=(a:number,b:number)=>new TextDecoder().decode(bytes.slice(a,b));
  return type==='application/pdf'?text(0,5)==='%PDF-'&&text(Math.max(0,bytes.length-1024),bytes.length).includes('%%EOF'):
    type==='image/jpeg'?bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217:
    type==='image/png'?bytes.length>24&&bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i])&&text(bytes.length-8,bytes.length-4)==='IEND':
    type==='image/webp'?bytes.length>16&&text(0,4)==='RIFF'&&text(8,12)==='WEBP'&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true)+8===bytes.length:false;
}
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT (d.created_by=$3 OR $2='admin') AS "canRemove",d.id,d.file_name AS "fileName",d.mime_type AS "mimeType",d.byte_size AS "byteSize",d.sha256,
    d.status,COALESCE((SELECT CASE WHEN x.status='running' AND x.created_at<now()-interval '3 minutes' THEN 'interrupted' ELSE x.status END FROM extraction_runs x WHERE x.document_id=d.id AND x.patient_id=d.patient_id ORDER BY x.created_at DESC LIMIT 1),'uploaded') AS "processingStatus",d.visible_to_patient AS "visibleToPatient",d.document_date AS "documentDate",d.created_at AS "createdAt",s.name AS "specialtyName"
    FROM medical_documents d LEFT JOIN medical_specialties s ON s.id=d.specialty_id
    WHERE d.patient_id=$1 AND d.archived_at IS NULL AND ($2='admin' OR (d.visible_to_patient AND (d.status='ready' OR d.created_by=$3))) ORDER BY d.created_at DESC LIMIT 200`,[id,user.role,user.id]);
  return Response.json({documents:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,user.role==='admin');
  const req=await boundedRequest(request,11*1024*1024),form=await req.formData(),file=form.get('file');
  if(!(file instanceof File)||!types.includes(file.type)||file.size<1||file.size>10*1024*1024)throw new Error('VALIDATION');
  const careTaskId=String(form.get('careTaskId')||'')||null;
  if(careTaskId&&!/^[0-9a-f-]{36}$/i.test(careTaskId))throw Error('VALIDATION');
  const bytes=new Uint8Array(await file.arrayBuffer());if(!validSignature(file.type,bytes))throw new Error('VALIDATION');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const existing=await query('SELECT id FROM medical_documents WHERE patient_id=$1 AND sha256=$2 AND status=$3 AND archived_at IS NULL',[id,sha256,'ready']);
  if(existing.rowCount)return Response.json({error:'Este documento ya está registrado para el paciente.',documentId:existing.rows[0].id},{status:409,headers:noCache});
  const docId=randomUUID(),key=`patients/${id}/documents/${docId}`,name=file.name.slice(0,200)||'Documento';
  await transaction(async client=>{
    if(careTaskId){
      const task=(await client.query('SELECT * FROM care_tasks WHERE patient_id=$1 AND id=$2 FOR UPDATE',[id,careTaskId])).rows[0];
      if(!task)throw Error('PATIENT');if(task.status!=='pending')throw Error('TASK_STATE');
      if(task.document_id&&(await client.query("SELECT 1 FROM medical_documents WHERE id=$1 AND archived_at IS NULL AND status IN ('pending','ready')",[task.document_id])).rowCount)throw Error('TASK_DOCUMENT');
    }
  await client.query(`INSERT INTO medical_documents(id,patient_id,file_name,mime_type,byte_size,sha256,object_key,created_by,visible_to_patient)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[docId,id,name,file.type,bytes.length,sha256,key,user.id,user.role==='patient']);

    if(careTaskId)await client.query('UPDATE care_tasks SET document_id=$3,version=version+1,updated_at=now() WHERE patient_id=$1 AND id=$2',[id,careTaskId,docId]);
  });
  try{
    await putObject(key,bytes,file.type);
    await transaction(async client=>{
      await client.query(`UPDATE medical_documents SET status='ready',updated_at=now() WHERE id=$1 AND status='pending'`,[docId]);
      await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
        VALUES($1,'upload','document',$2,$3)`,[user.id,docId,id]);
    });
  }catch(error){await query(`UPDATE medical_documents SET status='error',updated_at=now() WHERE id=$1 AND status='pending'`,[docId]);throw error}
  return Response.json({document:{id:docId,fileName:name,mimeType:file.type,byteSize:bytes.length,sha256}},{status:201,headers:noCache});
}catch(e){return failure(e)}}

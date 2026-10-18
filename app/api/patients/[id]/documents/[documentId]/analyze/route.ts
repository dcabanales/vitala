import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../../../lib/server';
import {query,transaction} from '../../../../../../lib/db';
import {getObject} from '../../../../../../lib/objects';
import {analyzeMedicalDocument,identityMismatch,extractedConsultation,extractedExamination} from '../../../../../../lib/extraction';
import {z} from 'zod';
import {identityIssues} from '../../../../../../lib/document-identity';
type Context={params:Promise<{id:string;documentId:string}>};
const input=z.object({kind:z.enum(['consultation','examination']),replaceReview:z.boolean().optional()}).strict();
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id,documentId}=await params;await authorizePatient(user,id,true);
  const r=await query(`SELECT id,review_version AS "reviewVersion",measurement_type_ids AS "measurementTypeIds",kind,CASE WHEN status='running' AND created_at<now()-interval '3 minutes' THEN 'interrupted' ELSE status END AS status,model,original_draft AS "originalDraft",schema_version AS "schemaVersion",draft,warning,error_code AS "errorCode",
    input_tokens AS "inputTokens",output_tokens AS "outputTokens",created_at AS "createdAt",finished_at AS "finishedAt",consultation_id AS "consultationId",examination_id AS "examinationId"
    FROM extraction_runs WHERE patient_id=$1 AND document_id=$2 ORDER BY created_at DESC LIMIT 20`,[id,documentId]);
  const patient=(await query<{name:string;birthDate:string|null}>('SELECT name,birth_date AS "birthDate" FROM patients WHERE id=$1',[id])).rows[0];
  return Response.json({runs:r.rows.map(run=>({...run,identityIssues:identityIssues(run.originalDraft||run.draft||{},patient)}))},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id,documentId}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,2048),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const kind=parsed.data.kind;
  if(!process.env.OPENAI_API_KEY)throw new Error('AI_CONFIG');
  const doc=await query<{file_name:string;mime_type:string;object_key:string;patient_name:string}>(`SELECT d.file_name,d.mime_type,d.object_key,p.name AS patient_name
    FROM medical_documents d JOIN patients p ON p.id=d.patient_id WHERE d.patient_id=$1 AND d.id=$2 AND d.status='ready' AND d.archived_at IS NULL`,[id,documentId]);
  if(!doc.rowCount)throw new Error('PATIENT');
  const model=process.env.OPENAI_MODEL||'gpt-6-luna';
  const run=await transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(742511,1)');
    if(!(await client.query('SELECT 1 FROM medical_documents WHERE patient_id=$1 AND id=$2 AND archived_at IS NULL FOR UPDATE',[id,documentId])).rowCount)throw Error('PATIENT');
    await client.query(`UPDATE extraction_runs SET status='interrupted',finished_at=now(),error_code='INTERRUPTED'
      WHERE status='running' AND created_at<now()-interval '3 minutes'`);
    const previous=(await client.query('SELECT status FROM extraction_runs WHERE patient_id=$1 AND document_id=$2 AND kind=$3 ORDER BY created_at DESC LIMIT 1',[id,documentId,kind])).rows[0];
    if(previous?.status==='running')throw Error('AI_BUSY');
    if(previous?.status==='confirmed'||(previous?.status==='review'&&!parsed.data.replaceReview))throw Error('CONFLICT');
    const count=await client.query(`SELECT count(*) FILTER(WHERE created_at>now()-interval '24 hours')::int AS daily,
      count(*) FILTER(WHERE status='running')::int AS running FROM extraction_runs`);
    if(count.rows[0].daily>=20)throw new Error('AI_BUDGET');
    if(count.rows[0].running>=2)throw new Error('AI_BUSY');
    const r=await client.query(`INSERT INTO extraction_runs(patient_id,document_id,kind,status,model,schema_version,created_by)
      VALUES($1,$2,$3,'running',$4,1,$5) RETURNING id`,[id,documentId,kind,model,user.id]);
    return r.rows[0].id as string;
  });
  try{
    const bytes=await getObject(doc.rows[0].object_key).catch(()=>{throw Error('AI_STORAGE')});
    const result=await analyzeMedicalDocument({key:doc.rows[0].object_key,mime:doc.rows[0].mime_type,name:doc.rows[0].file_name,bytes,model,kind});
    const mismatch=identityMismatch(result.draft.patientName,doc.rows[0].patient_name);
    await query(`UPDATE extraction_runs SET status='review',draft=$2,original_draft=$2,warning=$3,input_tokens=$4,output_tokens=$5,finished_at=now() WHERE id=$1`,
      [run,result.draft,mismatch?'El nombre del documento difiere del perfil. Revisa la identidad y confirma explícitamente si pertenece a este paciente.':null,
       result.usage.input_tokens??null,result.usage.output_tokens??null]);
    return Response.json({runId:run,draft:result.draft,identityMismatch:mismatch},{headers:noCache});
  }catch(error){
    const code=error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'AI_TIMEOUT':error instanceof Error&&['AI_AUTH','AI_ACCESS','AI_MODEL','AI_QUOTA','AI_RATE','AI_REQUEST','AI_INCOMPLETE','AI_INVALID','AI_STORAGE'].includes(error.message)?error.message:'AI_PROVIDER';
    await query(`UPDATE extraction_runs SET status='failed',error_code=$2,finished_at=now() WHERE id=$1`,[run,code.slice(0,80)]);
    throw new Error(code);
  }
}catch(e){return failure(e)}}

export async function PATCH(request:Request,{params}:Context){try{
 const user=await requireUser(request),{id,documentId}=await params;await authorizePatient(user,id,true);
 const req=await boundedRequest(request,90_000),body=z.object({runId:z.string().uuid(),reviewVersion:z.number().int().positive(),draft:z.unknown(),measurementTypeIds:z.array(z.string().uuid().nullable()).max(30).optional()}).strict().safeParse(await req.json());if(!body.success)throw Error('VALIDATION');
 const result=await transaction(async client=>{const run=(await client.query(`SELECT kind,review_version FROM extraction_runs WHERE id=$1 AND patient_id=$2 AND document_id=$3 AND status='review' FOR UPDATE`,[body.data.runId,id,documentId])).rows[0];if(!run)throw Error('PATIENT');if(run.review_version!==body.data.reviewVersion)throw Error('CONFLICT');
 const parsed=(run.kind==='examination'?extractedExamination:extractedConsultation).safeParse(body.data.draft);if(!parsed.success)throw Error('VALIDATION');
 const updated=await client.query('UPDATE extraction_runs SET draft=$2,measurement_type_ids=$3,review_version=review_version+1 WHERE id=$1 RETURNING review_version AS "reviewVersion"',[body.data.runId,parsed.data,body.data.measurementTypeIds===undefined?null:JSON.stringify(body.data.measurementTypeIds)]);
 await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'save_review','extraction',$2,$3)`,[user.id,body.data.runId,id]);return updated.rows[0]});
 return Response.json(result,{headers:noCache});
}catch(e){return failure(e)}}

import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../../../lib/server';
import {query,transaction} from '../../../../../../lib/db';
import {getObject} from '../../../../../../lib/objects';
import {analyzeMedicalDocument,identityMismatch} from '../../../../../../lib/extraction';
import {z} from 'zod';
import {identityIssues} from '../../../../../../lib/document-identity';
type Context={params:Promise<{id:string;documentId:string}>};
const input=z.object({kind:z.enum(['consultation','examination'])}).strict();
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id,documentId}=await params;await authorizePatient(user,id,true);
  const r=await query(`SELECT id,kind,status,model,original_draft AS "originalDraft",schema_version AS "schemaVersion",draft,warning,error_code AS "errorCode",
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
    FROM medical_documents d JOIN patients p ON p.id=d.patient_id WHERE d.patient_id=$1 AND d.id=$2 AND d.status='ready'`,[id,documentId]);
  if(!doc.rowCount)throw new Error('PATIENT');
  const model=process.env.OPENAI_MODEL||'gpt-6-luna';
  const run=await transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(742511,1)');
    await client.query(`UPDATE extraction_runs SET status='interrupted',finished_at=now(),error_code='INTERRUPTED'
      WHERE status='running' AND created_at<now()-interval '3 minutes'`);
    const count=await client.query(`SELECT count(*) FILTER(WHERE created_at>now()-interval '24 hours')::int AS daily,
      count(*) FILTER(WHERE status='running')::int AS running FROM extraction_runs`);
    if(count.rows[0].daily>=20)throw new Error('AI_BUDGET');
    if(count.rows[0].running>=2)throw new Error('AI_BUSY');
    const r=await client.query(`INSERT INTO extraction_runs(patient_id,document_id,kind,status,model,schema_version,created_by)
      VALUES($1,$2,$3,'running',$4,1,$5) RETURNING id`,[id,documentId,kind,model,user.id]);
    return r.rows[0].id as string;
  });
  try{
    const bytes=await getObject(doc.rows[0].object_key);
    const result=await analyzeMedicalDocument({key:doc.rows[0].object_key,mime:doc.rows[0].mime_type,name:doc.rows[0].file_name,bytes,model,kind});
    const mismatch=identityMismatch(result.draft.patientName,doc.rows[0].patient_name);
    await query(`UPDATE extraction_runs SET status='review',draft=$2,original_draft=$2,warning=$3,input_tokens=$4,output_tokens=$5,finished_at=now() WHERE id=$1`,
      [run,result.draft,mismatch?'El nombre del documento difiere del perfil. Revisa la identidad y confirma explícitamente si pertenece a este paciente.':null,
       result.usage.input_tokens??null,result.usage.output_tokens??null]);
    return Response.json({runId:run,draft:result.draft,identityMismatch:mismatch},{headers:noCache});
  }catch(error){
    const code=error instanceof Error?error.message:'AI_PROVIDER';
    await query(`UPDATE extraction_runs SET status='failed',error_code=$2,finished_at=now() WHERE id=$1`,[run,code.slice(0,80)]);
    throw error;
  }
}catch(e){return failure(e)}}

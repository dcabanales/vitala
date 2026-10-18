import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const decimal=z.string().regex(/^-?\d{1,12}(\.\d{1,12})?$/);
const input=z.object({typeId:z.string().uuid(),consultationId:z.string().uuid().nullish(),examinationId:z.string().uuid().nullish(),documentId:z.string().uuid().nullish(),documentedDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),valueKind:z.enum(['number','text','code','interval','components']),numericValue:decimal.nullish(),textValue:z.string().max(1000).nullish(),codeValue:z.string().max(200).nullish(),components:z.record(decimal).nullish(),comparator:z.enum(['<','<=','=','>=','>']).nullish(),originalValue:z.string().trim().min(1).max(500),unit:z.string().max(40).nullish(),referenceRange:z.string().max(300).nullish(),sample:z.string().max(200).nullish(),contextNote:z.string().max(1000).nullish(),status:z.enum(['draft','published']).default('published')}).strict()
  .refine(p=>!p.consultationId||!p.examinationId)
  .refine(p=>p.valueKind==='number'?!!p.numericValue:p.valueKind==='interval'?!!p.numericValue&&!!p.comparator:p.valueKind==='text'?!!p.textValue:p.valueKind==='code'?!!p.codeValue:!!p.components&&Object.keys(p.components).length>0&&Object.keys(p.components).length<=10);
export async function GET(req:Request,{params}:Context){try{const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT m.id,m.type_id AS "typeId",CASE WHEN EXISTS(SELECT 1 FROM medical_documents d WHERE d.id=m.document_id AND d.patient_id=m.patient_id AND d.status='ready' AND ($2='admin' OR d.visible_to_patient)) THEN m.document_id ELSE NULL END AS "documentId",t.name AS "typeName",t.category,m.documented_date AS "documentedDate",m.value_kind AS "valueKind",m.numeric_value AS "numericValue",
    m.text_value AS "textValue",m.code_value AS "codeValue",m.components,m.comparator,m.original_value AS "originalValue",m.unit,
    m.reference_range AS "referenceRange",m.sample,m.context_note AS "contextNote",m.examination_id AS "examinationId",m.consultation_id AS "consultationId",m.status
    FROM measurements m JOIN measurement_types t ON t.id=m.type_id WHERE m.patient_id=$1 AND m.status<>'void'
      AND ($2='admin' OR (m.status='published'
        AND (m.examination_id IS NULL OR EXISTS(SELECT 1 FROM examinations e WHERE e.patient_id=m.patient_id AND e.id=m.examination_id AND e.status='published'))
        AND (m.consultation_id IS NULL OR EXISTS(SELECT 1 FROM consultations c WHERE c.patient_id=m.patient_id AND c.id=m.consultation_id AND c.status='published'))))
    ORDER BY m.documented_date DESC NULLS LAST,m.created_at DESC LIMIT 300`,[id,user.role]);
  return Response.json({measurements:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,12_000),p=input.safeParse(await req.json());if(!p.success)throw new Error('VALIDATION');const x=p.data;
  const type=await query<{value_kind:string}>('SELECT value_kind FROM measurement_types WHERE id=$1 AND active',[x.typeId]);if(type.rows[0]?.value_kind!==x.valueKind)throw new Error('VALIDATION');
  const row=await transaction(async client=>{
    if(x.status==='published'&&x.examinationId){
      const parent=await client.query('SELECT status FROM examinations WHERE patient_id=$1 AND id=$2 FOR SHARE',[id,x.examinationId]);
      if(parent.rows[0]?.status!=='published')throw new Error('VALIDATION');
    }
    if(x.status==='published'&&x.consultationId){
      const parent=await client.query('SELECT status FROM consultations WHERE patient_id=$1 AND id=$2 FOR SHARE',[id,x.consultationId]);
      if(parent.rows[0]?.status!=='published')throw new Error('VALIDATION');
    }
    const r=await client.query(`INSERT INTO measurements(patient_id,type_id,consultation_id,examination_id,document_id,documented_date,value_kind,numeric_value,
      text_value,code_value,components,comparator,original_value,unit,reference_range,sample,context_note,status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [id,x.typeId,x.consultationId||null,x.examinationId||null,x.documentId||null,x.documentedDate||null,x.valueKind,x.numericValue||null,
       x.textValue||null,x.codeValue||null,x.components||null,x.comparator||null,x.originalValue,x.unit||null,x.referenceRange||null,x.sample||null,x.contextNote||null,x.status,user.id]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','measurement',$2,$3)`,[user.id,r.rows[0].id,id]);return r.rows[0];
  });return Response.json({measurement:row},{status:201,headers:noCache});
}catch(e){return failure(e)}}

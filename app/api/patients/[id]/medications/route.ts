import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {reviseRecord} from '../../../../lib/record-revision';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const input=z.object({medicationId:z.string().uuid(),treatmentId:z.string().uuid().nullish(),dose:z.string().max(200).nullish(),frequency:z.string().max(200).nullish(),route:z.string().max(120).nullish(),instructions:z.string().max(3000).nullish(),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),state:z.enum(['planned','active','completed','suspended','paused','unknown']).default('unknown'),documentId:z.string().uuid().nullish(),status:z.enum(['draft','published']).default('published')}).strict();
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT pm.id,pm.version,pm.medication_id AS "medicationId",m.name,m.active_ingredient AS "activeIngredient",pm.treatment_id AS "treatmentId",pm.dose,pm.frequency,pm.route,pm.instructions,
    pm.start_date AS "startDate",pm.end_date AS "endDate",pm.state,pm.status,pm.document_id AS "documentId"
    FROM patient_medications pm JOIN medications m ON m.id=pm.medication_id WHERE pm.patient_id=$1 AND pm.status<>'void' AND ($2='admin' OR pm.status='published')
    ORDER BY (pm.state='active') DESC,pm.start_date DESC NULLS LAST,m.name`,[id,user.role]);
  return Response.json({medications:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,12_000),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  if(p.startDate&&p.endDate&&p.endDate<p.startDate)throw Error('VALIDATION');
  const row=await transaction(async client=>{
    const r=await client.query(`INSERT INTO patient_medications(patient_id,medication_id,treatment_id,dose,frequency,route,instructions,start_date,end_date,state,document_id,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [id,p.medicationId,p.treatmentId||null,p.dose||null,p.frequency||null,p.route||null,p.instructions||null,p.startDate||null,p.endDate||null,p.state,p.documentId||null,p.status]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','medication_use',$2,$3)`,[user.id,r.rows[0].id,id]);return r.rows[0];
  });return Response.json({medication:row},{status:201,headers:noCache});
}catch(e){return failure(e)}}

export async function PATCH(request:Request,{params}:Context){try{
 const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
 const req=await boundedRequest(request,16_000),parsed=input.partial().extend({id:z.string().uuid(),version:z.number().int().positive(),status:z.enum(['draft','published','void']).optional(),changeReason:z.string().trim().min(1).max(500)}).strict().safeParse(await req.json());
 if(!parsed.success)throw Error('VALIDATION');const p=parsed.data;
 const item=await reviseRecord({table:'patient_medications',resource:'medication_use',patientId:id,actorId:user.id,recordId:p.id,version:p.version,reason:p.changeReason,changes:p,columns:{medicationId:'medication_id',treatmentId:'treatment_id',dose:'dose',frequency:'frequency',route:'route',instructions:'instructions',startDate:'start_date',endDate:'end_date',state:'state',status:'status',documentId:'document_id'}});
 return Response.json({medication:item},{headers:noCache});
}catch(e){return failure(e)}}

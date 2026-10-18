import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../../lib/server';
import {transaction} from '../../../../../lib/db';
import {treatmentBase} from '../../../../../lib/schemas';
import {z} from 'zod';
type Context={params:Promise<{id:string;treatmentId:string}>};
const update=treatmentBase.omit({requestKey:true}).partial().extend({status:z.enum(['draft','published','void']).optional(),version:z.number().int().positive(),changeReason:z.string().trim().min(1).max(500)});
export async function PATCH(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id,treatmentId}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,25_000),parsed=update.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  const map:Record<string,string>={consultationId:'consultation_id',name:'name',indication:'indication',doctorId:'doctor_id',startDate:'start_date',endDate:'end_date',state:'state',instructions:'instructions',note:'note',status:'status'};
  const values:unknown[]=[id,treatmentId,p.version],sets:string[]=[];
  for(const [key,column] of Object.entries(map)){if(Object.hasOwn(p,key)){values.push((p as Record<string,unknown>)[key]||null);sets.push(`${column}=$${values.length}`)}}
  if(!sets.length)throw new Error('VALIDATION');
  const row=await transaction(async client=>{
    const before=await client.query('SELECT * FROM treatments WHERE patient_id=$1 AND id=$2 FOR UPDATE',[id,treatmentId]);
    if(!before.rowCount||before.rows[0].version!==p.version)throw new Error('CONFLICT');
    await client.query(`INSERT INTO treatment_revisions(treatment_id,patient_id,previous_version,snapshot,reason,changed_by)
      VALUES($1,$2,$3,$4,$5,$6)`,[treatmentId,id,p.version,before.rows[0],p.changeReason,user.id]);
    const r=await client.query(`UPDATE treatments SET ${sets.join(',')},version=version+1,updated_at=now()
      WHERE patient_id=$1 AND id=$2 AND version=$3 RETURNING id,version,state,status`,values);
    if(!r.rowCount)throw new Error('CONFLICT');
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'update','treatment',$2,$3)`,[user.id,treatmentId,id]);return r.rows[0];
  });return Response.json({treatment:row},{headers:noCache});
}catch(e){return failure(e)}}

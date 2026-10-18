import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../../lib/server';
import {query,transaction} from '../../../../../lib/db';
import {consultationInput} from '../../../../../lib/schemas';
import {z} from 'zod';
type Context={params:Promise<{id:string;consultationId:string}>};
const update=consultationInput.omit({requestKey:true}).partial().extend({status:z.enum(['draft','published','void']).optional(),version:z.number().int().positive(),changeReason:z.string().trim().min(1).max(500)});
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id,consultationId}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT c.*,d.name AS doctor_name,m.name AS center_name,s.name AS specialty_name
    FROM consultations c LEFT JOIN doctors d ON d.id=c.doctor_id LEFT JOIN medical_centers m ON m.id=c.center_id
    LEFT JOIN medical_specialties s ON s.id=c.specialty_id WHERE c.patient_id=$1 AND c.id=$2 AND ($3='admin' OR c.status='published') AND c.status<>'void'`,[id,consultationId,user.role]);
  if(!r.rowCount)throw new Error('PATIENT');return Response.json({consultation:r.rows[0]},{headers:noCache});
}catch(e){return failure(e)}}
export async function PATCH(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id,consultationId}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,50_000),parsed=update.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  const map:Record<string,string>={eventDate:'event_date',doctorId:'doctor_id',centerId:'center_id',specialtyId:'specialty_id',doctorAsDocumented:'doctor_as_documented',centerAsDocumented:'center_as_documented',reason:'reason',symptoms:'symptoms',summary:'summary',findings:'findings',impression:'impression',conclusion:'conclusion',recommendations:'recommendations',followUp:'follow_up',status:'status'};
  const values:unknown[]=[id,consultationId,p.version],sets:string[]=[];
  for(const [key,column] of Object.entries(map)){if(Object.hasOwn(p,key)){values.push((p as Record<string,unknown>)[key]||null);sets.push(`${column}=$${values.length}`)}}
  if(p.specialtyId)sets.push('specialty_as_documented=NULL');
  if(!sets.length)throw new Error('VALIDATION');
  const row=await transaction(async client=>{
    const before=await client.query('SELECT * FROM consultations WHERE patient_id=$1 AND id=$2 FOR UPDATE',[id,consultationId]);
    if(!before.rowCount||before.rows[0].version!==p.version)throw new Error('CONFLICT');
    if(p.status==='draft'){
      const linked=await client.query(`SELECT 1 FROM measurements WHERE patient_id=$1 AND consultation_id=$2 AND status='published' LIMIT 1`,
        [id,consultationId]);
      if(linked.rowCount)throw new Error('CONFLICT');
    }
    await client.query(`INSERT INTO consultation_revisions(consultation_id,patient_id,previous_version,snapshot,reason,changed_by)
      VALUES($1,$2,$3,$4,$5,$6)`,[consultationId,id,p.version,before.rows[0],p.changeReason,user.id]);
    const r=await client.query(`UPDATE consultations SET ${sets.join(',')},version=version+1,updated_at=now()
      WHERE patient_id=$1 AND id=$2 AND version=$3 RETURNING id,version,status`,values);
    if(!r.rowCount)throw new Error('CONFLICT');
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'update','consultation',$2,$3)`,[user.id,consultationId,id]);
    return r.rows[0];
  });return Response.json({consultation:row},{headers:noCache});
}catch(e){return failure(e)}}

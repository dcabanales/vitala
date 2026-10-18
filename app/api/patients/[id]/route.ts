import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../lib/server';
import {query,transaction} from '../../../lib/db';
import {patientUpdate} from '../../../lib/schemas';
type Context={params:Promise<{id:string}>};
export const runtime='nodejs';
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT id,name,birth_date AS "birthDate",sex,blood_group AS "bloodGroup",phone,contact,
    profile_note AS "profileNote",archived_at AS "archivedAt",version,created_at AS "createdAt",updated_at AS "updatedAt"
    FROM patients WHERE id=$1`,[id]);
  return Response.json({patient:r.rows[0]},{headers:noCache});
}catch(e){return failure(e)}}
export async function PATCH(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,16_000),parsed=patientUpdate.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const p=parsed.data;
  const map:Record<string,string>={name:'name',birthDate:'birth_date',sex:'sex',bloodGroup:'blood_group',phone:'phone',contact:'contact',profileNote:'profile_note'};
  const values:unknown[]=[id,p.version],sets:string[]=[];
  for(const [key,column] of Object.entries(map)){if(Object.hasOwn(p,key)){values.push((p as Record<string,unknown>)[key]);sets.push(`${column}=$${values.length}`)}}
  if(p.archived!==undefined)sets.push(`archived_at=${p.archived?'now()':'NULL'}`);
  if(!sets.length)throw new Error('VALIDATION');
  const result=await transaction(async client=>{
    const updated=await client.query(`UPDATE patients SET ${sets.join(',')},version=version+1,updated_at=now()
      WHERE id=$1 AND version=$2 RETURNING id,version`,values);
    if(!updated.rowCount)throw new Error('CONFLICT');
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'update','patient',$2,$2)`,[user.id,id]);
    return updated.rows[0];
  });
  return Response.json({patient:result},{headers:noCache});
}catch(e){return failure(e)}}

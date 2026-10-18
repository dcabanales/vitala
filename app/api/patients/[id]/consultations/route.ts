import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {consultationInput} from '../../../../lib/schemas';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT c.id,c.event_date AS "eventDate",c.status,c.reason,c.summary,c.conclusion,
    COALESCE(c.doctor_as_documented,d.name) AS "doctorName",COALESCE(c.center_as_documented,m.name) AS "centerName",
    COALESCE(c.specialty_as_documented,s.name) AS "specialtyName",c.created_at AS "createdAt" FROM consultations c
    LEFT JOIN doctors d ON d.id=c.doctor_id LEFT JOIN medical_centers m ON m.id=c.center_id
    LEFT JOIN medical_specialties s ON s.id=c.specialty_id
    WHERE c.patient_id=$1 AND ($2='admin' OR c.status='published') AND c.status<>'void'
    ORDER BY c.event_date DESC NULLS LAST,c.created_at DESC`,[id,user.role]);
  return Response.json({consultations:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,50_000),parsed=consultationInput.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const c=parsed.data;
  const row=await transaction(async client=>{
    const result=await client.query(`INSERT INTO consultations(patient_id,request_key,event_date,doctor_id,center_id,specialty_id,
      doctor_as_documented,center_as_documented,reason,symptoms,summary,findings,impression,conclusion,recommendations,follow_up,status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT(patient_id,request_key) WHERE request_key IS NOT NULL DO NOTHING RETURNING id,status`,
      [id,c.requestKey,c.eventDate||null,c.doctorId||null,c.centerId||null,c.specialtyId||null,c.doctorAsDocumented||null,
       c.centerAsDocumented||null,c.reason||null,c.symptoms||null,c.summary||null,c.findings||null,c.impression||null,c.conclusion||null,
       c.recommendations||null,c.followUp||null,c.status,user.id]);
    if(!result.rowCount)return (await client.query('SELECT id,status FROM consultations WHERE patient_id=$1 AND request_key=$2',[id,c.requestKey])).rows[0];
    const created=result.rows[0];
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
      VALUES($1,'create','consultation',$2,$3)`,[user.id,created.id,id]);
    return created;
  });
  return Response.json({consultation:row},{status:201,headers:noCache});
}catch(e){return failure(e)}}

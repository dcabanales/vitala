import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {treatmentInput} from '../../../../lib/schemas';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Context){try{
  const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT t.id,t.name,t.indication,t.start_date AS "startDate",t.end_date AS "endDate",t.state,t.status,t.instructions,
    t.note,t.version,d.name AS "doctorName" FROM treatments t LEFT JOIN doctors d ON d.id=t.doctor_id
    WHERE t.patient_id=$1 AND t.status<>'void' AND ($2='admin' OR t.status='published')
    ORDER BY (t.state='active') DESC,t.start_date DESC NULLS LAST,t.created_at DESC LIMIT 100`,[id,user.role]);
  return Response.json({treatments:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,25_000),parsed=treatmentInput.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  const row=await transaction(async client=>{
    const r=await client.query(`INSERT INTO treatments(patient_id,request_key,consultation_id,name,indication,doctor_id,start_date,end_date,state,instructions,note,status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT(patient_id,request_key) WHERE request_key IS NOT NULL DO NOTHING RETURNING id,status`,
      [id,p.requestKey,p.consultationId||null,p.name,p.indication||null,p.doctorId||null,p.startDate||null,p.endDate||null,p.state,p.instructions||null,p.note||null,p.status,user.id]);
    if(!r.rowCount)return (await client.query('SELECT id,status FROM treatments WHERE patient_id=$1 AND request_key=$2',[id,p.requestKey])).rows[0];
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','treatment',$2,$3)`,[user.id,r.rows[0].id,id]);
    return r.rows[0];
  });return Response.json({treatment:row},{status:201,headers:noCache});
}catch(e){return failure(e)}}

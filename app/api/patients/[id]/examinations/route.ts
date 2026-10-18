import {requireUser,authorizePatient,failure,noCache,boundedRequest} from '../../../../lib/server';
import {query,transaction} from '../../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{id:string}>};
const input=z.object({name:z.string().trim().min(1).max(200),eventDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),consultationId:z.string().uuid().nullish(),specialtyId:z.string().uuid().nullish(),doctorId:z.string().uuid().nullish(),centerId:z.string().uuid().nullish(),indication:z.string().max(4000).nullish(),findings:z.string().max(8000).nullish(),conclusion:z.string().max(8000).nullish(),documentId:z.string().uuid().nullish(),status:z.enum(['draft','published']).default('draft')}).strict();
export async function GET(req:Request,{params}:Context){try{const user=await requireUser(req),{id}=await params;await authorizePatient(user,id);
  const r=await query(`SELECT e.id,e.name,e.event_date AS "eventDate",e.indication,e.findings,e.conclusion,e.status,e.version,
    COALESCE(s.name,e.specialty_as_documented) AS "specialtyName",COALESCE(d.name,e.doctor_as_documented) AS "doctorName",COALESCE(m.name,e.center_as_documented) AS "centerName"
    FROM examinations e LEFT JOIN medical_specialties s ON s.id=e.specialty_id LEFT JOIN doctors d ON d.id=e.doctor_id
    LEFT JOIN medical_centers m ON m.id=e.center_id WHERE e.patient_id=$1 AND e.status<>'void' AND ($2='admin' OR e.status='published')
    ORDER BY e.event_date DESC NULLS LAST,e.created_at DESC`,[id,user.role]);
  return Response.json({examinations:r.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{const user=await requireUser(request),{id}=await params;await authorizePatient(user,id,true);
  const req=await boundedRequest(request,25_000),p=input.safeParse(await req.json());if(!p.success)throw new Error('VALIDATION');const x=p.data;
  const row=await transaction(async client=>{
    const r=await client.query(`INSERT INTO examinations(patient_id,consultation_id,name,event_date,specialty_id,doctor_id,center_id,indication,findings,conclusion,status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,[id,x.consultationId||null,x.name,x.eventDate||null,x.specialtyId||null,x.doctorId||null,x.centerId||null,x.indication||null,x.findings||null,x.conclusion||null,x.status,user.id]);
    if(x.documentId)await client.query('INSERT INTO examination_documents(patient_id,examination_id,document_id) VALUES($1,$2,$3)',[id,r.rows[0].id,x.documentId]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','examination',$2,$3)`,[user.id,r.rows[0].id,id]);return r.rows[0];
  });return Response.json({examination:row},{status:201,headers:noCache});
}catch(e){return failure(e)}}

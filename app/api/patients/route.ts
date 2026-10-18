import {requireUser,failure,noCache,boundedRequest} from '../../lib/server';
import {query,transaction} from '../../lib/db';
import {patientCreate} from '../../lib/schemas';
export const runtime='nodejs';
export async function GET(req:Request){try{
  const user=await requireUser(req),url=new URL(req.url),search=(url.searchParams.get('q')||'').slice(0,100),page=Math.max(1,Math.min(1000,Number(url.searchParams.get('page'))||1)),archived=url.searchParams.get('archived')==='1';
  const r=await query(`SELECT p.id,p.name,p.birth_date AS "birthDate",p.blood_group AS "bloodGroup",p.archived_at AS "archivedAt",p.updated_at AS "updatedAt",p.version
    FROM patients p JOIN patient_access_grants g ON g.patient_id=p.id
    WHERE g.user_id=$1 AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>now())
      AND (p.archived_at IS NOT NULL)=$2 AND p.name ILIKE $3
    ORDER BY p.name,p.id LIMIT 21 OFFSET $4`,[user.id,archived,`%${search}%`,(page-1)*20]);
  return Response.json({patients:r.rows.slice(0,20),hasMore:r.rows.length>20,page},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
  const user=await requireUser(request);if(user.role!=='admin')throw new Error('ROLE');
  const req=await boundedRequest(request,16_000),parsed=patientCreate.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');
  const p=parsed.data;
  const result=await transaction(async client=>{
    const created=await client.query(`INSERT INTO patients(name,birth_date,sex,blood_group,phone,contact,profile_note)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,version`,[p.name,p.birthDate||null,p.sex||null,p.bloodGroup||null,p.phone||null,p.contact||null,p.profileNote||null]);
    const id=created.rows[0].id;
    await client.query(`INSERT INTO patient_access_grants(patient_id,user_id,access_level,authorized_by,basis,created_by)
      VALUES($1,$2,'write',$3,$4,$2)`,[id,user.id,p.authorizedBy,p.basis]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'create','patient',$2,$2)`,[user.id,id]);
    return created.rows[0];
  });
  return Response.json({patient:result},{status:201,headers:noCache});
}catch(e){return failure(e)}}

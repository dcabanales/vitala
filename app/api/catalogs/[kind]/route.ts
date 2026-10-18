import {requireUser,failure,noCache,boundedRequest} from '../../../lib/server';
import {query,transaction} from '../../../lib/db';
import {z} from 'zod';
type Context={params:Promise<{kind:string}>};
const tables={specialties:'medical_specialties',centers:'medical_centers',doctors:'doctors',conditions:'medical_conditions',medications:'medications'} as const;
type Kind=keyof typeof tables;
function table(kind:string){if(!(kind in tables))throw new Error('VALIDATION');return tables[kind as Kind]}
const input=z.object({name:z.string().trim().min(1).max(200),active:z.boolean().optional(),specialtyIds:z.array(z.string().uuid()).optional(),centerIds:z.array(z.string().uuid()).optional(),description:z.string().max(3000).optional(),activeIngredient:z.string().max(200).optional(),source:z.string().max(500).optional(),city:z.string().max(160).optional(),country:z.string().max(100).optional(),registration:z.string().max(100).optional(),jurisdiction:z.string().max(100).optional()}).strict();
export async function GET(req:Request,{params}:Context){try{
  await requireUser(req);const {kind}=await params,sqlTable=table(kind);
  const all=new URL(req.url).searchParams.get('all')==='1';
  const result=await query(`SELECT * FROM ${sqlTable} WHERE active OR $1 ORDER BY name LIMIT 300`,[all]);
  if(kind==='doctors'){
    const links=await query(`SELECT doctor_id,specialty_id,center_id FROM
      (SELECT doctor_id,specialty_id,NULL::uuid AS center_id FROM doctor_specialties UNION ALL
       SELECT doctor_id,NULL::uuid AS specialty_id,center_id FROM doctor_centers) x`);
    return Response.json({items:result.rows.map(d=>({...d,specialtyIds:links.rows.filter(l=>l.doctor_id===d.id&&l.specialty_id).map(l=>l.specialty_id),centerIds:links.rows.filter(l=>l.doctor_id===d.id&&l.center_id).map(l=>l.center_id)}))},{headers:noCache});
  }
  return Response.json({items:result.rows},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:Context){try{
  const user=await requireUser(request);if(user.role!=='admin')throw new Error('ROLE');const {kind}=await params,sqlTable=table(kind);
  const req=await boundedRequest(request,12_000),parsed=input.safeParse(await req.json());if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  const item=await transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[kind+':'+p.name.toLowerCase()]);
    if((await client.query(`SELECT 1 FROM ${sqlTable} WHERE lower(trim(name))=lower(trim($1))`,[p.name])).rowCount)throw new Error('DUPLICATE');
    let result;
    if(kind==='centers')result=await client.query(`INSERT INTO medical_centers(name,city,country) VALUES($1,$2,$3) RETURNING *`,[p.name,p.city||null,p.country||null]);
    else if(kind==='doctors')result=await client.query(`INSERT INTO doctors(name,registration,jurisdiction) VALUES($1,$2,$3) RETURNING *`,[p.name,p.registration||null,p.jurisdiction||null]);
    else if(kind==='medications')result=await client.query(`INSERT INTO medications(name,active_ingredient,description,source) VALUES($1,$2,$3,$4) RETURNING *`,[p.name,p.activeIngredient||null,p.description||null,p.source||null]);
    else if(kind==='conditions')result=await client.query(`INSERT INTO medical_conditions(name,description) VALUES($1,$2) RETURNING *`,[p.name,p.description||null]);
    else result=await client.query(`INSERT INTO ${sqlTable}(name) VALUES($1) RETURNING *`,[p.name]);
    const id=result.rows[0].id;
    if(kind==='doctors'){
      for(const sid of p.specialtyIds||[])await client.query('INSERT INTO doctor_specialties(doctor_id,specialty_id) VALUES($1,$2)',[id,sid]);
      for(const cid of p.centerIds||[])await client.query('INSERT INTO doctor_centers(doctor_id,center_id) VALUES($1,$2)',[id,cid]);
    }
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES($1,'create',$2,$3)`,[user.id,kind,id]);
    return result.rows[0];
  });
  return Response.json({item},{status:201,headers:noCache});
}catch(e){return failure(e)}}
export async function PATCH(request:Request,{params}:Context){try{
  const user=await requireUser(request);if(user.role!=='admin')throw new Error('ROLE');const {kind}=await params,sqlTable=table(kind);
  const req=await boundedRequest(request,12_000),raw=await req.json(),parsed=input.partial().extend({id:z.string().uuid()}).safeParse(raw);if(!parsed.success)throw new Error('VALIDATION');const p=parsed.data;
  const item=await transaction(async client=>{
    const found=await client.query(`SELECT id FROM ${sqlTable} WHERE id=$1 FOR UPDATE`,[p.id]);if(!found.rowCount)throw new Error('PATIENT');
    if(p.name!==undefined){await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[kind+':'+p.name.toLowerCase()]);if((await client.query(`SELECT 1 FROM ${sqlTable} WHERE lower(trim(name))=lower(trim($1)) AND id<>$2`,[p.name,p.id])).rowCount)throw Error('DUPLICATE');}
    if(p.name!==undefined)await client.query(`UPDATE ${sqlTable} SET name=$2 WHERE id=$1`,[p.id,p.name]);
    if(p.active!==undefined)await client.query(`UPDATE ${sqlTable} SET active=$2 WHERE id=$1`,[p.id,p.active]);
    const fields:Record<string,string[]>= {centers:['city','country'],doctors:['registration','jurisdiction'],conditions:['description'],medications:['activeIngredient','description','source']};
    for(const key of fields[kind]||[]){if(Object.hasOwn(p,key)){const col=key==='activeIngredient'?'active_ingredient':key;await client.query(`UPDATE ${sqlTable} SET ${col}=$2 WHERE id=$1`,[p.id,(p as Record<string,unknown>)[key]||null])}}
    if(kind==='doctors'){
      if(p.specialtyIds){await client.query('DELETE FROM doctor_specialties WHERE doctor_id=$1',[p.id]);for(const sid of p.specialtyIds)await client.query('INSERT INTO doctor_specialties(doctor_id,specialty_id) VALUES($1,$2)',[p.id,sid])}
      if(p.centerIds){await client.query('DELETE FROM doctor_centers WHERE doctor_id=$1',[p.id]);for(const cid of p.centerIds)await client.query('INSERT INTO doctor_centers(doctor_id,center_id) VALUES($1,$2)',[p.id,cid])}
    }
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES($1,'update',$2,$3)`,[user.id,kind,p.id]);
    return (await client.query(`SELECT * FROM ${sqlTable} WHERE id=$1`,[p.id])).rows[0];
  });
  return Response.json({item},{headers:noCache});
}catch(e){return failure(e)}}

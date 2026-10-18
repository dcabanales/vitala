import {requireUser,failure,noCache,boundedRequest} from '../../lib/server';
import {query,transaction} from '../../lib/db';
import {z} from 'zod';
const input=z.object({name:z.string().trim().min(1).max(160),category:z.enum(['vital','laboratory','other']),valueKind:z.enum(['number','text','code','interval','components']),defaultUnit:z.string().max(40).nullish()}).strict();
export async function GET(req:Request){try{const user=await requireUser(req),all=new URL(req.url).searchParams.get('all')==='1'&&user.role==='admin';
  const r=await query('SELECT id,name,category,value_kind AS "valueKind",default_unit AS "defaultUnit",active FROM measurement_types WHERE active OR $1 ORDER BY category,name',[all]);
  return Response.json({types:r.rows},{headers:noCache})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const user=await requireUser(request);if(user.role!=='admin')throw new Error('ROLE');const req=await boundedRequest(request,4096),p=input.safeParse(await req.json());if(!p.success)throw new Error('VALIDATION');
  const item=await transaction(async client=>{
    const r=await client.query(`INSERT INTO measurement_types(name,category,value_kind,default_unit) VALUES($1,$2,$3,$4) RETURNING id`,
      [p.data.name,p.data.category,p.data.valueKind,p.data.defaultUnit||null]);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES($1,'create','measurement_type',$2)`,[user.id,r.rows[0].id]);
    return r.rows[0];
  });return Response.json({type:item},{status:201,headers:noCache})}catch(e){return failure(e)}}
export async function PATCH(request:Request){try{const user=await requireUser(request);if(user.role!=='admin')throw new Error('ROLE');
  const req=await boundedRequest(request,4096),p=input.partial().extend({id:z.string().uuid(),active:z.boolean().optional()}).strict().safeParse(await req.json());
  if(!p.success)throw new Error('VALIDATION');
  const item=await transaction(async client=>{
    const before=await client.query('SELECT * FROM measurement_types WHERE id=$1 FOR UPDATE',[p.data.id]);if(!before.rowCount)throw new Error('PATIENT');
    if(p.data.valueKind&&p.data.valueKind!==before.rows[0].value_kind&&(await client.query('SELECT 1 FROM measurements WHERE type_id=$1 LIMIT 1',[p.data.id])).rowCount)throw new Error('CONFLICT');
    const values:unknown[]=[p.data.id],sets:string[]=[];
    for(const [key,column] of Object.entries({name:'name',category:'category',valueKind:'value_kind',defaultUnit:'default_unit',active:'active'})){if(Object.hasOwn(p.data,key)){values.push((p.data as Record<string,unknown>)[key]);sets.push(`${column}=$${values.length}`)}}
    if(!sets.length)throw new Error('VALIDATION');
    const r=await client.query(`UPDATE measurement_types SET ${sets.join(',')} WHERE id=$1 RETURNING id,active`,values);
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES($1,'update','measurement_type',$2)`,[user.id,p.data.id]);
    return r.rows[0];
  });return Response.json({type:item},{headers:noCache})}catch(e){return failure(e)}}

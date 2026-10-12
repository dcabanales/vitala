export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import {accountContext,readWorkspace,failure,noCache,boundedRequest} from '../../lib/server';
import {workspaceSchema} from '../../lib/model';

export async function GET(req:Request){try{const {bucket,prefix}=await accountContext(req);return Response.json({...await readWorkspace(bucket,prefix),aiReady:!!process.env.OPENAI_API_KEY},{headers:noCache})}catch(e){return failure(e)}}
export async function PUT(request:Request){try{
 const req=await boundedRequest(request,2_000_000);const {bucket,prefix}=await accountContext(req);const raw=await req.text();if(raw.length>2000000)return Response.json({error:'Se ha alcanzado el límite de datos del espacio.'},{status:413});
 const body=JSON.parse(raw) as {patients:unknown;etag?:string};const parsed=workspaceSchema.safeParse({patients:body.patients});
 if(!parsed.success)return Response.json({error:'Revisa nombres, fechas y datos de los pacientes.'},{status:400});
 const current=await readWorkspace(bucket,prefix);
 if(current.etag!==(body.etag||null))return Response.json({error:'Los datos cambiaron en otra ventana. Recarga antes de guardar.'},{status:409});
 if(current.patients.some(p=>!parsed.data.patients.some(n=>n.id===p.id)))return Response.json({error:'No se permite eliminar pacientes al guardar. Tus historiales se conservan.'},{status:400});
 const result=await bucket.put(prefix+'patients-v2.json',JSON.stringify(parsed.data),{onlyIf:body.etag?{etagMatches:body.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 if(!result)return Response.json({error:'Los datos cambiaron en otra ventana. Recarga antes de guardar.'},{status:409});
 return Response.json({etag:result.etag,patients:parsed.data.patients},{headers:noCache});
}catch(e){return failure(e)}}

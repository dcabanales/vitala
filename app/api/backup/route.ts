import {accountContext,noCache} from '../../lib/server';
import {database} from '../../lib/storage';
import {backup} from 'node:sqlite';
import {Readable} from 'node:stream';
import {createReadStream} from 'node:fs';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 let dir:string|undefined;
 try{
  await accountContext(req);dir=await mkdtemp(join(tmpdir(),'vitala-backup-'));
  const file=join(dir,'vitala.sqlite');await backup(database(),file);const info=await stat(file);
  const stream=createReadStream(file);stream.once('close',()=>{void rm(dir!,{recursive:true,force:true})});
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>,{headers:{...noCache,'Content-Type':'application/vnd.sqlite3','Content-Length':String(info.size),'Content-Disposition':`attachment; filename="vitala-${new Date().toISOString().slice(0,10)}.sqlite"`,'X-Content-Type-Options':'nosniff'}});
 }catch{
  if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{});
  return Response.json({error:'No se pudo crear la copia de seguridad.'},{status:500,headers:noCache});
 }
}

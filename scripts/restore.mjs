import {mkdtemp,rm,stat,open,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createDecipheriv,createHash,scryptSync} from 'node:crypto';
import pg from 'pg';
import {pgConfig,run,objectExists,writeObject,writeAll} from './archive-common.mjs';
process.umask(0o077);
const input=process.env.RESTORE_INPUT,passphrase=process.env.BACKUP_PASSPHRASE;
if(!input||!passphrase)throw Error('Usa RESTORE_INPUT y BACKUP_PASSPHRASE.');
const source=await open(resolve(input),'r'),temp=await mkdtemp(join(tmpdir(),'vitala-restore-'));
const plainPath=join(temp,'archive.plain'),dumpPath=join(temp,'database.dump');
let plain;
try{
  const size=(await source.stat()).size;if(size<8+16+12+16+12)throw Error('Copia demasiado corta');
  const header=Buffer.alloc(36);await source.read(header,0,36,0);if(header.subarray(0,8).toString()!=='VITALA1\n')throw Error('Formato de copia inválido');
  const tag=Buffer.alloc(16);await source.read(tag,0,16,size-16);
  const decipher=createDecipheriv('aes-256-gcm',scryptSync(passphrase,header.subarray(8,24),32),header.subarray(24,36));decipher.setAuthTag(tag);
  plain=await open(plainPath,'wx',0o600);
  let position=36;while(position<size-16){const bytes=Buffer.alloc(Math.min(65536,size-16-position));const r=await source.read(bytes,0,bytes.length,position);if(!r.bytesRead)throw Error('Copia truncada');position+=r.bytesRead;await writeAll(plain,decipher.update(bytes.subarray(0,r.bytesRead)))}
  await writeAll(plain,decipher.final());await plain.sync();await plain.close();plain=null;
  const data=await open(plainPath,'r');let offset=0;
  const read=async length=>{const b=Buffer.alloc(length);const r=await data.read(b,0,length,offset);if(r.bytesRead!==length)throw Error('Copia truncada');offset+=length;return b};
  const manifestSize=(await read(4)).readUInt32BE();if(manifestSize>10_000_000)throw Error('Manifiesto inválido');
  const manifest=JSON.parse((await read(manifestSize)).toString());if(manifest.version!==1||!Array.isArray(manifest.objects))throw Error('Versión de copia no compatible');
  const dumpSize=Number((await read(8)).readBigUInt64BE());if(!Number.isSafeInteger(dumpSize)||dumpSize>50_000_000_000)throw Error('Dump inválido');
  const dump=await open(dumpPath,'wx',0o600);let remaining=dumpSize;
  while(remaining){const chunk=await read(Math.min(65536,remaining));await writeAll(dump,chunk);remaining-=chunk.length}await dump.close();
  const objects=[];
  for(const meta of manifest.objects){
    if(!/^patients\/[0-9a-f-]{36}\/documents\/[0-9a-f-]{36}$/.test(meta.key)||!Number.isInteger(meta.size)||meta.size<1||meta.size>10*1024*1024)throw Error('Manifiesto inválido');
    const length=Number((await read(8)).readBigUInt64BE());if(length!==meta.size)throw Error('Tamaño de objeto distinto');
    const bytes=await read(length),sha=createHash('sha256').update(bytes).digest('hex');if(sha!==meta.sha256)throw Error('Hash de objeto distinto');
    const path=join(temp,`object-${objects.length}.bin`);await writeFile(path,bytes,{flag:'wx',mode:0o600});
    objects.push({...meta,path});
  }
  if(offset!==(await stat(plainPath)).size)throw Error('Datos inesperados al final de la copia');await data.close();
  const {database,env}=pgConfig(),url=new URL(process.env.DATABASE_URL),pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,ssl:['localhost','127.0.0.1'].includes(url.hostname)?false:{rejectUnauthorized:true}});
  try{const r=await pool.query("SELECT to_regclass('public.users') AS users");if(r.rows[0].users)throw Error('La base destino no está vacía; restauración cancelada.')}finally{await pool.end()}
  for(const meta of objects)if(await objectExists(meta.key))throw Error('El bucket destino ya contiene un objeto de la copia; restauración cancelada.');
  for(const meta of objects)await writeObject(meta.key,new Uint8Array(await readFile(meta.path)),meta.mime);
  await run('pg_restore',['--single-transaction','--no-owner','--no-acl','--dbname',database,dumpPath],env);
  process.stdout.write(`Restauración completada: ${objects.length} objetos verificados.\n`);
}finally{if(plain)await plain.close();await source.close();await rm(temp,{recursive:true,force:true})}

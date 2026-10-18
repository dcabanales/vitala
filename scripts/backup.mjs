import {mkdtemp,rm,stat,open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createCipheriv,createHash,randomBytes,scryptSync} from 'node:crypto';
import {createReadStream} from 'node:fs';
import pg from 'pg';
import {pgConfig,run,readObject,writeAll,u32,u64} from './archive-common.mjs';
process.umask(0o077);
const output=process.env.BACKUP_OUTPUT,passphrase=process.env.BACKUP_PASSPHRASE;
if(!output||!passphrase||passphrase.length<20)throw Error('Usa BACKUP_OUTPUT y BACKUP_PASSPHRASE (mínimo 20 caracteres).');
const target=resolve(output),temp=await mkdtemp(join(tmpdir(),'vitala-backup-'));
let out;
try{
  const {database,env}=pgConfig(),dump=join(temp,'database.dump');
  await run('pg_dump',['--format=custom','--no-owner','--no-acl','--file',dump,'--dbname',database],env);
  const url=new URL(process.env.DATABASE_URL),pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,ssl:['localhost','127.0.0.1'].includes(url.hostname)?false:{rejectUnauthorized:true}});
  let objects;try{objects=(await pool.query(`SELECT object_key AS key,sha256,byte_size AS size,mime_type AS mime FROM medical_documents WHERE status='ready' ORDER BY object_key`)).rows}finally{await pool.end()}
  const manifest=Buffer.from(JSON.stringify({version:1,createdAt:new Date().toISOString(),objects}),'utf8');
  if(manifest.length>10_000_000)throw Error('Manifiesto demasiado grande');
  out=await open(target,'wx',0o600);
  const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',scryptSync(passphrase,salt,32),iv);
  await writeAll(out,Buffer.concat([Buffer.from('VITALA1\n'),salt,iv]));
  const writePlain=async bytes=>writeAll(out,cipher.update(bytes));
  await writePlain(u32(manifest.length));await writePlain(manifest);
  const dumpSize=(await stat(dump)).size;await writePlain(u64(dumpSize));
  for await(const chunk of createReadStream(dump))await writePlain(chunk);
  for(const meta of objects){
    const bytes=await readObject(meta.key),hash=createHash('sha256').update(bytes).digest('hex');
    if(bytes.length!==meta.size||hash!==meta.sha256)throw Error('Un objeto no coincide con su hash; copia cancelada.');
    await writePlain(u64(bytes.length));await writePlain(bytes);
  }
  await writeAll(out,cipher.final());await writeAll(out,cipher.getAuthTag());await out.sync();await out.close();out=null;
  process.stdout.write(`Copia cifrada creada: ${target} (${objects.length} objetos).\n`);
}catch(error){if(out){await out.close();await rm(target,{force:true})}throw error}
finally{await rm(temp,{recursive:true,force:true})}

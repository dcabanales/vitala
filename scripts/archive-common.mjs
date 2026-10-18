import {S3Client,GetObjectCommand,PutObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';

export function pgConfig(){
  if(!process.env.DATABASE_URL)throw Error('Falta DATABASE_URL');
  const url=new URL(process.env.DATABASE_URL);
  return {database:decodeURIComponent(url.pathname.slice(1)),env:{...process.env,
    PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),
    PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGSSLMODE:url.searchParams.get('sslmode')||(['localhost','127.0.0.1'].includes(url.hostname)?'disable':'verify-full')}};
}
export function run(command,args,env){return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{env,stdio:['ignore','ignore','pipe']});let error='';
  child.stderr.on('data',chunk=>{error+=String(chunk).slice(0,1000)});
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(`${command} falló (${code}). ${error.slice(0,300)}`)));
})}
function keyPath(key){
  if(!/^patients\/[0-9a-f-]{36}\/documents\/[0-9a-f-]{36}$/.test(key))throw Error('Clave de objeto inválida');
  return join(resolve(process.env.LOCAL_OBJECT_DIR||'/private/tmp/vitala-objects'),...key.split('/'));
}
let client;
function remote(){
  const bucket=process.env.OBJECT_BUCKET,endpoint=process.env.AWS_ENDPOINT_URL_S3,region=process.env.AWS_REGION,
    accessKeyId=process.env.AWS_ACCESS_KEY_ID,secretAccessKey=process.env.AWS_SECRET_ACCESS_KEY;
  if(!bucket||!endpoint||!region||!accessKeyId||!secretAccessKey||new URL(endpoint).protocol!=='https:')throw Error('Falta configuración del bucket privado');
  client??=new S3Client({endpoint,region,forcePathStyle:true,credentials:{accessKeyId,secretAccessKey},maxAttempts:2});
  return {client,bucket};
}
export async function readObject(key){
  if(process.env.OBJECT_STORAGE_DRIVER==='local')return new Uint8Array(await readFile(keyPath(key)));
  const {client,bucket}=remote(),r=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  if(!r.Body)throw Error('Objeto vacío');return await r.Body.transformToByteArray();
}
export async function objectExists(key){
  if(process.env.OBJECT_STORAGE_DRIVER==='local'){try{await access(keyPath(key));return true}catch{return false}}
  const {client,bucket}=remote();try{await client.send(new HeadObjectCommand({Bucket:bucket,Key:key}));return true}catch(e){if(e?.$metadata?.httpStatusCode===404)return false;throw e}
}
export async function writeObject(key,body,mime){
  if(process.env.OBJECT_STORAGE_DRIVER==='local'){const path=keyPath(key);await mkdir(resolve(path,'..'),{recursive:true,mode:0o700});await writeFile(path,body,{flag:'wx',mode:0o600});return}
  const {client,bucket}=remote();await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:mime}));
}
export async function writeAll(handle,buffer){let offset=0;while(offset<buffer.length){const r=await handle.write(buffer,offset,buffer.length-offset);offset+=r.bytesWritten}}
export function u32(n){const b=Buffer.alloc(4);b.writeUInt32BE(n);return b}
export function u64(n){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(n));return b}

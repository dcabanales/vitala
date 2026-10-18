import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
let s3:S3Client|undefined;
function localRoot(){
  const local=['localhost','127.0.0.1'];
  const localTest=local.includes(new URL(process.env.APP_ORIGIN||'https://invalid.example').hostname)
    &&local.includes(new URL(process.env.DATABASE_URL||'postgresql://invalid.example/test').hostname);
  if(process.env.NODE_ENV==='production'&&!localTest)throw new Error('CONFIG');
  return resolve(process.env.LOCAL_OBJECT_DIR||'/private/tmp/vitala-objects');
}
function localPath(key:string){
  if(!/^patients\/[0-9a-f-]{36}\/documents\/[0-9a-f-]{36}$/.test(key))throw new Error('CONFIG');
  return join(localRoot(),...key.split('/'));
}
function config(){
  const endpoint=process.env.AWS_ENDPOINT_URL_S3,region=process.env.AWS_REGION,bucket=process.env.OBJECT_BUCKET,
    accessKeyId=process.env.AWS_ACCESS_KEY_ID,secretAccessKey=process.env.AWS_SECRET_ACCESS_KEY;
  if(!endpoint||!region||!bucket||!accessKeyId||!secretAccessKey)throw new Error('CONFIG');
  if(new URL(endpoint).protocol!=='https:')throw new Error('CONFIG');
  s3??=new S3Client({endpoint,region,forcePathStyle:true,credentials:{accessKeyId,secretAccessKey},maxAttempts:2});
  return {client:s3,bucket};
}
export async function putObject(key:string,body:Uint8Array,mime:string){
  if(process.env.OBJECT_STORAGE_DRIVER==='local'){
    const path=localPath(key);await mkdir(resolve(path,'..'),{recursive:true,mode:0o700});await writeFile(path,body,{flag:'wx',mode:0o600});return;
  }
  const {client,bucket}=config();await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:mime}));
}
export async function getObject(key:string){
  if(process.env.OBJECT_STORAGE_DRIVER==='local')return new Uint8Array(await readFile(localPath(key)));
  const {client,bucket}=config(),result=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  if(!result.Body)throw new Error('OBJECT');return await result.Body.transformToByteArray();
}
export async function removeObject(key:string){
  if(process.env.OBJECT_STORAGE_DRIVER==='local'){await unlink(localPath(key));return}
  const {client,bucket}=config();await client.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));
}

import {cookies} from 'next/headers';
import {createHash,createHmac,randomBytes,scrypt as callbackScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {query} from './db';

const scrypt=promisify(callbackScrypt);
export type User={id:string;email:string;role:'admin'|'patient'};
export function settings(){
  const secret=process.env.SESSION_SECRET,origin=process.env.APP_ORIGIN;
  if(!secret||secret.length<32||!origin)throw new Error('CONFIG');
  const url=new URL(origin);
  if(url.origin!==origin||(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('CONFIG');
  return {secret,origin,secure:url.protocol==='https:'};
}
export function tokenHash(token:string){return createHash('sha256').update(token).digest('hex')}
export function newOpaqueToken(){return randomBytes(32).toString('base64url')}
function csrfSignature(value:string){return createHmac('sha256',settings().secret).update('csrf\n'+value).digest('base64url')}
export function csrfToken(){const value=`${Date.now()+30*60_000}.${randomBytes(24).toString('base64url')}`;return value+'.'+csrfSignature(value)}
function validCsrfToken(token:string|undefined){
  if(!token||token.length>256)return false;
  const parts=token.split('.');if(parts.length!==3)return false;
  const expiry=Number(parts[0]);if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+30*60_000)return false;
  const value=parts[0]+'.'+parts[1],actual=Buffer.from(parts[2]),expected=Buffer.from(csrfSignature(value));
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function checkOrigin(req:Request,token?:string){
  const allowed=settings().origin,origin=req.headers.get('origin');
  if(origin===allowed)return;
  if(origin&&origin!=='null')throw new Error('ORIGIN');
  const referer=req.headers.get('referer');
  if(referer){try{if(new URL(referer).origin===allowed)return}catch{}}
  if(validCsrfToken(token||req.headers.get('x-csrf-token')||undefined))return;
  throw new Error('ORIGIN');
}
export async function passwordHash(password:string){
  if(password.length<14||password.length>256)throw new Error('PASSWORD');
  const salt=randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await scrypt(password,salt,64) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password:string,hash:string){
  const [algorithm,salt,hex]=hash.split(':');
  if(algorithm!=='scrypt'||! /^[a-f0-9]{32}$/.test(salt||'')||! /^[a-f0-9]{128}$/.test(hex||'')||password.length>256)return false;
  const actual=await scrypt(password,salt,64) as Buffer;
  return timingSafeEqual(actual,Buffer.from(hex,'hex'));
}
export function cookieName(){return settings().secure?'__Host-vitala':'vitala'}
export async function createSession(userId:string){
  const token=newOpaqueToken();
  await query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'8 hours\')',[tokenHash(token),userId]);
  return token;
}
export async function currentUser():Promise<User|null>{
  const token=(await cookies()).get(cookieName())?.value;
  if(!token||token.length>128)return null;
  const result=await query<User>(`SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active'`,[tokenHash(token)]);
  return result.rows[0]||null;
}
export async function revokeSession(token:string|undefined){if(token)await query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL',[tokenHash(token)])}

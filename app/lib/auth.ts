import { cookies } from 'next/headers';
import {createHmac,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export function settings(){
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),hash=process.env.ADMIN_PASSWORD_HASH,secret=process.env.SESSION_SECRET,origin=process.env.APP_ORIGIN;
 if(!email||!hash||!secret||secret.length<32||!origin)throw new Error('CONFIG');
 const url=new URL(origin);if(url.origin!==origin||(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('CONFIG');
 return {email,hash,secret,origin,secure:url.protocol==='https:'};
}
export function checkOrigin(req:Request){if(req.headers.get('origin')!==settings().origin)throw new Error('ORIGIN');}
function signature(value:string){const {secret,hash,email}=settings();return createHmac('sha256',secret).update(hash+'\n'+email+'\n'+value).digest('base64url');}
export async function verifyPassword(password:string){
 const [algorithm,salt,hex]=settings().hash.split(':');
 if(algorithm!=='scrypt'||! /^[a-f0-9]{32}$/.test(salt||'')||! /^[a-f0-9]{128}$/.test(hex||''))throw new Error('CONFIG');
 const actual=await derive(password,salt,64) as Buffer;return timingSafeEqual(actual,Buffer.from(hex,'hex'));
}
export function cookieName(){return settings().secure?'__Host-vitala':'vitala';}
export function sessionToken(){const value=`${Date.now()+8*3600_000}.${randomBytes(24).toString('base64url')}`;return value+'.'+signature(value);}
export async function currentUser(){
 const config=settings(),token=(await cookies()).get(cookieName())?.value;if(!token||token.length>256)return null;
 const parts=token.split('.');if(parts.length!==3)return null;
 const expiry=Number(parts[0]);if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+8*3600_000)return null;
 const actual=Buffer.from(parts[2]),expected=Buffer.from(signature(parts[0]+'.'+parts[1]));
 return actual.length===expected.length&&timingSafeEqual(actual,expected)?{userId:'owner',email:config.email}:null;
}

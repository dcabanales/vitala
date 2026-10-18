import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(bytes:Uint8Array){
  let value=0,bits=0,result='';
  for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-=5))&31]}}
  if(bits>0)result+=alphabet[(value<<(5-bits))&31];
  return result;
}
export function base32Decode(input:string){
  const text=input.replace(/\s|-/g,'').toUpperCase();
  if(!/^[A-Z2-7]+$/.test(text))throw new Error('MFA_CODE');
  let value=0,bits=0;const bytes:number[]=[];
  for(const char of text){value=(value<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){bytes.push((value>>>(bits-=8))&255)}}
  return Buffer.from(bytes);
}
export function newMfaSecret(){return base32Encode(randomBytes(20))}
export function totp(secret:string,time=Date.now()){
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(time/30_000)));
  const digest=createHmac('sha1',base32Decode(secret)).update(counter).digest(),offset=digest[digest.length-1]&15;
  const number=(digest.readUInt32BE(offset)&0x7fffffff)%1_000_000;
  return String(number).padStart(6,'0');
}
export function validTotp(secret:string,code:string,time=Date.now()){
  if(!/^\d{6}$/.test(code))return false;
  for(const delta of [-1,0,1]){
    const expected=totp(secret,time+delta*30_000);
    if(timingSafeEqual(Buffer.from(code),Buffer.from(expected)))return true;
  }
  return false;
}
function key(master:string){if(master.length<32)throw new Error('CONFIG');return createHash('sha256').update('vitala-mfa-v1\n'+master).digest()}
export function encryptMfaSecret(secret:string,master:string){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(master),iv);
  const body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');
}
export function decryptMfaSecret(value:string,master:string){
  const bytes=Buffer.from(value,'base64url');if(bytes.length<29)throw new Error('CONFIG');
  const decipher=createDecipheriv('aes-256-gcm',key(master),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
}
export function newRecoveryCode(){const raw=base32Encode(randomBytes(10));return raw.match(/.{1,4}/g)!.join('-')}
export function recoveryCodeHash(code:string){
  const normalized=code.replace(/[\s-]/g,'').toUpperCase();
  if(!/^[A-Z2-7]{16}$/.test(normalized))return null;
  return createHash('sha256').update('vitala-recovery-v1\n'+normalized).digest('hex');
}

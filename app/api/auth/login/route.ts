import {checkOrigin,cookieName,sessionToken,settings,verifyPassword} from '../../../lib/auth';
import {consumeLimit} from '../../../lib/storage';
import {boundedRequest,failure} from '../../../lib/server';
import {NextResponse} from 'next/server';
import {createHmac} from 'node:crypto';
export const runtime='nodejs';
export async function POST(request:Request){try{
 checkOrigin(request);const config=settings();
 const rawIp=process.env.FLY_APP_NAME?request.headers.get('fly-client-ip')||'fly-unknown':'local';
 const rateKey=createHmac('sha256',config.secret).update(rawIp.slice(0,128)).digest('hex');
 if(!consumeLimit('login:'+rateKey,10,900))return NextResponse.redirect(new URL('/login?error=rate',config.origin),303);
 const form=await (await boundedRequest(request,4096)).formData();
 const email=String(form.get('email')||'').trim().toLowerCase(),password=String(form.get('password')||'');
 const valid=password.length<=256&&await verifyPassword(password);
 if(!valid||email!==config.email)return NextResponse.redirect(new URL('/login?error=invalid',config.origin),303);
 const response=NextResponse.redirect(new URL('/',config.origin),303);response.headers.set('Cache-Control','no-store');
 response.cookies.set(cookieName(),sessionToken(),{httpOnly:true,secure:config.secure,sameSite:'strict',path:'/',maxAge:8*3600});return response;
}catch(e){return failure(e)}}

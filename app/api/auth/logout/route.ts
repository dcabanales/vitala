import {checkOrigin,cookieName,revokeSession,settings} from '../../../lib/auth';
import {failure} from '../../../lib/server';
import {NextResponse} from 'next/server';
export async function POST(req:Request){try{
  const form=await req.formData();checkOrigin(req,String(form.get('csrfToken')||''));
  const config=settings();await revokeSession(req.headers.get('cookie')?.match(new RegExp('(?:^|;\\s*)'+cookieName()+'=([^;]+)'))?.[1]);
  const r=NextResponse.redirect(new URL('/login',config.origin),303);
  r.cookies.set(cookieName(),'',{httpOnly:true,secure:config.secure,sameSite:'strict',path:'/',maxAge:0});
  r.headers.set('Cache-Control','no-store');return r;
}catch(e){return failure(e)}}

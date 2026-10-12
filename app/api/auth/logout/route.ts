import {checkOrigin,cookieName,settings} from '../../../lib/auth';
import {failure} from '../../../lib/server';
import {NextResponse} from 'next/server';
export async function POST(req:Request){try{checkOrigin(req);const config=settings();const r=NextResponse.redirect(new URL('/login',config.origin),303);r.cookies.set(cookieName(),'',{httpOnly:true,secure:config.secure,sameSite:'strict',path:'/',maxAge:0});r.headers.set('Cache-Control','no-store');return r}catch(e){return failure(e)}}

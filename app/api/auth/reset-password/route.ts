import {checkOrigin,cookieName,passwordHash,tokenHash,settings} from '../../../lib/auth';
import {transaction} from '../../../lib/db';
import {boundedRequest} from '../../../lib/server';
import {NextResponse} from 'next/server';
export async function POST(request:Request){
  const config=settings();
  try{
    const req=await boundedRequest(request,4096),form=await req.formData();
    checkOrigin(request,String(form.get('csrfToken')||''));
    const token=String(form.get('token')||''),password=String(form.get('password')||''),repeat=String(form.get('repeatPassword')||'');
    if(!/^[A-Za-z0-9_-]{43}$/.test(token)||password!==repeat)throw new Error('VALIDATION');
    const hash=await passwordHash(password);
    const changed=await transaction(async client=>{
      const r=await client.query(`SELECT user_id FROM password_resets
        WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE`,[tokenHash(token)]);
      if(!r.rowCount)return false;
      const userId=r.rows[0].user_id;
      await client.query('UPDATE users SET password_hash=$2 WHERE id=$1 AND status=$3',[userId,hash,'active']);
      await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
      await client.query('UPDATE password_resets SET used_at=now() WHERE token_hash=$1',[tokenHash(token)]);
      await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id)
        VALUES($1,'reset_password','user',$1)`,[userId]);
      return true;
    });
    const response=NextResponse.redirect(new URL(changed?'/login?reset=1':'/login?error=reset',config.origin),303);
    response.cookies.set(cookieName(),'',{httpOnly:true,secure:config.secure,sameSite:'strict',path:'/',maxAge:0});
    response.headers.set('Cache-Control','no-store');
    return response;
  }catch{
    return NextResponse.redirect(new URL('/login?error=reset',config.origin),303);
  }
}

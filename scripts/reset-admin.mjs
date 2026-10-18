import pg from 'pg';
import {randomBytes,scryptSync} from 'node:crypto';
const email=process.env.ADMIN_RESET_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_RESET_PASSWORD;
const connectionString=process.env.DATABASE_URL;
if(!email||!password||password.length<14||password.length>256||!connectionString)
  throw Error('Usa ADMIN_RESET_EMAIL, ADMIN_RESET_PASSWORD (14–256 caracteres) y DATABASE_URL.');
const url=new URL(connectionString);
const pool=new pg.Pool({connectionString,max:1,ssl:['localhost','127.0.0.1'].includes(url.hostname)?false:{rejectUnauthorized:true}});
const salt=randomBytes(16).toString('hex'),hash=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
try{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const r=await client.query(`UPDATE users SET password_hash=$2 WHERE email=$1 AND role='admin' AND status='active' RETURNING id`,[email,hash]);
    if(!r.rowCount)throw Error('No existe esa cuenta administradora activa.');
    await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[r.rows[0].id]);
    if(process.env.ADMIN_RESET_MFA==='1'){
      await client.query('DELETE FROM admin_recovery_codes WHERE user_id=$1',[r.rows[0].id]);
      await client.query('DELETE FROM admin_mfa WHERE user_id=$1',[r.rows[0].id]);
      await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id)
        VALUES($1,'admin_mfa_recovery','user',$1)`,[r.rows[0].id]);
    }
    await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id)
      VALUES($1,'admin_password_recovery','user',$1)`,[r.rows[0].id]);
    await client.query('COMMIT');
    process.stdout.write(process.env.ADMIN_RESET_MFA==='1'
      ?'Contraseña y MFA restablecidos; sesiones anteriores revocadas. Configura MFA de nuevo antes de abrir el piloto.\n'
      :'Contraseña administrativa cambiada; sesiones anteriores revocadas. MFA permanece activo.\n');
  }catch(error){await client.query('ROLLBACK');throw error}
  finally{client.release()}
}finally{await pool.end()}

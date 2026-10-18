import pg from 'pg';
import {randomBytes,scrypt as callbackScrypt} from 'node:crypto';
import {promisify} from 'node:util';
const email=process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase(),password=process.env.BOOTSTRAP_PASSWORD;
if(!email||!password||password.length<14||!process.env.DATABASE_URL)throw Error('Usa BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD (mínimo 14 caracteres) y DATABASE_URL');
const salt=randomBytes(16).toString('hex'),hash=`scrypt:${salt}:${(await promisify(callbackScrypt)(password,salt,64)).toString('hex')}`;
const url=new URL(process.env.DATABASE_URL),pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:['localhost','127.0.0.1'].includes(url.hostname)?false:{rejectUnauthorized:true},max:1});
try{
  const r=await pool.query(`INSERT INTO users(email,password_hash,role) SELECT $1,$2,'admin'
    WHERE NOT EXISTS(SELECT 1 FROM users WHERE role='admin') RETURNING id`,[email,hash]);
  if(!r.rowCount)throw Error('Ya existe una cuenta administradora. No se modificó.');
  process.stdout.write('Cuenta administradora creada. Retira BOOTSTRAP_PASSWORD del entorno.\n');
}finally{await pool.end()}

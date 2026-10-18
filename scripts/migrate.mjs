import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import pg from 'pg';
const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw Error('Falta DATABASE_URL');
const url=new URL(connectionString);
const pool=new pg.Pool({connectionString,ssl:['localhost','127.0.0.1'].includes(url.hostname)?false:{rejectUnauthorized:true},max:1});
try{
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>/^\d+_[\w-]+\.sql$/.test(n)).sort()){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      if(!(await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount){
        await client.query(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
        process.stdout.write(`Aplicada ${name}\n`);
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
  }
}finally{await pool.end()}

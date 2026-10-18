import {Pool,types,type PoolClient, type QueryResultRow} from 'pg';

// PostgreSQL DATE has no timezone. Keep its calendar value instead of letting
// node-postgres convert local midnight to a Date in another timezone.
types.setTypeParser(1082,value=>value);

let pool:Pool|undefined;
export function database(){
  if(pool)return pool;
  const connectionString=process.env.DATABASE_URL;
  if(!connectionString)throw new Error('CONFIG');
  const url=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('CONFIG');
  pool=new Pool({connectionString,max:3,idleTimeoutMillis:30_000,connectionTimeoutMillis:10_000,
    ssl:url.hostname==='localhost'||url.hostname==='127.0.0.1'?false:{rejectUnauthorized:true}});
  return pool;
}
export async function query<T extends QueryResultRow=QueryResultRow>(sql:string,params:unknown[]=[]){return database().query<T>(sql,params);}
export async function transaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await database().connect();
  try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}

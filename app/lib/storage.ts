import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

type Row = { key: string; body: Uint8Array; metadata: string; etag: string; uploaded: string };
type PutOptions = { httpMetadata?: {contentType?:string}; customMetadata?:Record<string,string>; onlyIf?:{etagMatches?:string;etagDoesNotMatch?:string} };
let connection: DatabaseSync | undefined;
export function database() {
  if(connection)return connection;
  const dir=resolve(process.env.DATA_DIR||'./data');mkdirSync(dir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(dir,'vitala.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS objects(key TEXT PRIMARY KEY,body BLOB NOT NULL,metadata TEXT NOT NULL,etag TEXT NOT NULL,uploaded TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`);
  connection=db;return db;
}
function object(row:Row) {
  const metadata=JSON.parse(row.metadata) as PutOptions, bytes=Uint8Array.from(row.body);
  return {key:row.key,body:bytes,size:bytes.length,etag:row.etag,uploaded:new Date(row.uploaded),...metadata,
    async json<T>(){return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;},
    async arrayBuffer(){return bytes.buffer;}};
}
export class Storage {
  async get(key:string){const row=database().prepare('SELECT * FROM objects WHERE key=?').get(key) as Row|undefined;return row?object(row):null;}
  async put(key:string,body:string|Uint8Array,options:PutOptions={}){
    const bytes=Buffer.from(body),etag=createHash('sha256').update(bytes).digest('hex'),db=database();
    db.exec('BEGIN IMMEDIATE');try{
      const current=db.prepare('SELECT etag FROM objects WHERE key=?').get(key) as {etag:string}|undefined, condition=options.onlyIf;
      if((condition?.etagMatches&&current?.etag!==condition.etagMatches)||(condition?.etagDoesNotMatch==='*'&&current)){db.exec('ROLLBACK');return null;}
      db.prepare(`INSERT INTO objects VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,metadata=excluded.metadata,etag=excluded.etag,uploaded=excluded.uploaded`)
        .run(key,bytes,JSON.stringify({httpMetadata:options.httpMetadata,customMetadata:options.customMetadata}),etag,new Date().toISOString());
      db.exec('COMMIT');return {etag};
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  async delete(key:string){database().prepare('DELETE FROM objects WHERE key=?').run(key);}
  async list(options:{prefix:string;cursor?:string;include?:string[]}){
    const rows=database().prepare('SELECT key,length(body) size,metadata,etag,uploaded FROM objects WHERE substr(key,1,?)=? AND key>? ORDER BY key LIMIT 101')
      .all(options.prefix.length,options.prefix,options.cursor||'') as Array<Omit<Row,'body'>&{size:number}>;
    const page=rows.slice(0,100);return {objects:page.map(r=>({key:r.key,size:r.size,etag:r.etag,uploaded:new Date(r.uploaded),...JSON.parse(r.metadata) as PutOptions})),truncated:rows.length>100,cursor:rows.length>100?page.at(-1)!.key:undefined};
  }
}
export const storage=new Storage();
export function consumeLimit(key:string,max:number,seconds:number){
  const now=Math.floor(Date.now()/1000),db=database();db.exec('BEGIN IMMEDIATE');try{
    db.prepare('DELETE FROM limits WHERE expires<=?').run(now);
    const row=db.prepare('SELECT count FROM limits WHERE key=?').get(key) as {count:number}|undefined;
    if(row&&row.count>=max){db.exec('COMMIT');return false;}
    db.prepare('INSERT INTO limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,1,now+seconds);
    db.exec('COMMIT');return true;
  }catch(e){db.exec('ROLLBACK');throw e;}
}

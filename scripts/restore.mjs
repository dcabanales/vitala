import {DatabaseSync,backup} from 'node:sqlite';
import {stat,mkdir,chmod} from 'node:fs/promises';
import path from 'node:path';
const src=process.argv[2];if(!src){console.error('Uso: npm run restore -- /ruta/a/vitala-<fecha>.sqlite');process.exit(2);}
const source=path.resolve(src),info=await stat(source);if(!info.isFile()||info.size<16)throw Error('La copia de seguridad no es un archivo válido.');
const dir=path.resolve(process.env.DATA_DIR||'./data');await mkdir(dir,{recursive:true,mode:0o700});const target=path.join(dir,'vitala.sqlite');
try{await stat(target);throw Error('Ya existe una base de datos. No se sobrescribió.');}catch(e){if(e.code!=='ENOENT')throw e;}
const db=new DatabaseSync(source,{readOnly:true});try{const header=db.prepare('PRAGMA quick_check').get();if(header?.quick_check!=='ok')throw Error('La base de datos está dañada.');const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('objects','limits')").all().map(r=>r.name);if(!tables.includes('objects')||!tables.includes('limits'))throw Error('El archivo no es una copia de seguridad de Vitala.');await backup(db,target);await chmod(target,0o600);console.log(`Copia restaurada en ${target}.`);}finally{db.close();}

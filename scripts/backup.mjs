import {backup} from 'node:sqlite';
import {database} from '../app/lib/storage.ts';
import {mkdir,chmod} from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve(process.env.DATA_DIR||'./data','backups');await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
const file=path.join(dir,`vitala-${new Date().toISOString().replaceAll(':','-')}.sqlite`);
await backup(database(),file);await chmod(file,0o600);
console.log(`Copia de seguridad creada en ${file}. Guárdala cifrada fuera de Fly.io.`);

import {randomBytes,scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {writeFile,chmod,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scrypt=promisify(scryptCallback);
function hidden(prompt){return new Promise((resolve,reject)=>{
 if(!stdin.isTTY||!stdin.setRawMode) {reject(Error('Ejecuta npm run setup desde una terminal interactiva.'));return;}
 stdout.write(prompt);stdin.setRawMode(true);stdin.resume();let bytes=[],escape=false;
 const finish=(error)=>{stdin.setRawMode(false);stdin.pause();stdin.off('data',onData);stdout.write('\n');error?reject(error):resolve(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bytes)));};
 const onData=(buffer)=>{for(const b of buffer){if(escape){escape=b===13||b===10?false:b===27;continue;}if(b===3){finish(Error('Configuración cancelada.'));return;}if(b===13||b===10){finish();return;}if(b===127||b===8){let i=bytes.length-1;while(i>0&&(bytes[i]&192)===128)i--;bytes.splice(i);continue;}if(b>=32){bytes.push(b);}}};
 stdin.on('data',onData);
});}
const rl=createInterface({input:stdin,output:stdout});
try{
 const suggested='vitala-'+randomBytes(3).toString('hex');
 const app=(await rl.question(`Nombre único de tu app en Fly.io [${suggested}]: `)).trim()||suggested;
 if(!/^[a-z][a-z0-9-]{2,39}$/.test(app))throw Error('El nombre debe usar minúsculas, números y guiones (3–40 caracteres).');
 const email=(await rl.question('Tu correo de acceso a Vitala: ')).trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Escribe una dirección de correo válida.');
 rl.close();
 let password=await hidden('Crea una contraseña privada de al menos 14 caracteres (no se mostrará): ');
 if(password.length<14||password.length>256)throw Error('La contraseña debe tener entre 14 y 256 caracteres.');
 let confirm=await hidden('Repite la contraseña (no se mostrará): ');
 if(password!==confirm)throw Error('Las contraseñas no coinciden.');
 const origin=`https://${app}.fly.dev`,salt=randomBytes(16).toString('hex');
 const hash=`scrypt:${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;password='';confirm='';
 const session=randomBytes(48).toString('base64url');
 const contents=`APP_ORIGIN=${origin}\nADMIN_EMAIL=${email}\nADMIN_PASSWORD_HASH=${hash}\nSESSION_SECRET=${session}\n`;
 for(const filename of ['.env.fly','.env.local','fly.toml']){try{await access(path.join(root,filename));throw Error(`Ya existe ${filename}; se conservaron todos tus archivos.`);}catch(e){if(e.message.includes('Ya existe'))throw e;}}
 await writeFile(envPath,contents,{mode:0o600,flag:'wx'});await chmod(envPath,0o600);
 await writeFile(path.join(root,'.env.local'),`APP_ORIGIN=http://localhost:3000\nADMIN_EMAIL=${email}\nADMIN_PASSWORD_HASH=${hash}\nSESSION_SECRET=${session}\nDATA_DIR=./data\nOPENAI_MODEL=gpt-6-luna\n`,{mode:0o600,flag:'wx'});await chmod(path.join(root,'.env.local'),0o600);
 const flyToml=`app = "${app}"\nprimary_region = "mad"\n\n[build]\n  dockerfile = "Dockerfile"\n\n[env]\n  NODE_ENV = "production"\n  DATA_DIR = "/data"\n  OPENAI_MODEL = "gpt-6-luna"\n  PORT = "8080"\n\n[http_service]\n  internal_port = 8080\n  force_https = true\n  auto_stop_machines = "off"\n  auto_start_machines = true\n  min_machines_running = 1\n\n[[http_service.checks]]\n  method = "GET"\n  path = "/api/health"\n  interval = "30s"\n  timeout = "5s"\n  grace_period = "30s"\n\n[[mounts]]\n  source = "vitala_data"\n  destination = "/data"\n\n[[vm]]\n  cpu_kind = "shared"\n  cpus = 1\n  memory = "512mb"\n`;
 await writeFile(path.join(root,'fly.toml'),flyToml,{flag:'wx'});
 console.log(`\nConfiguración lista para ${app}.fly.dev. Contraseña guardada solo como hash.\n\nDesde esta carpeta, ejecuta:\n  fly auth login\n  fly launch --no-deploy --ha=false --name ${app} --region mad\n  fly volumes create vitala_data --app ${app} --region mad --size 1\n  fly secrets import --app ${app} < .env.fly\n  npm run import:openai -- ../../work/vitala/.dev.vars\n  fly deploy --ha=false\n`);
 console.log('El paso de OpenAI es opcional: consulta README.md para enviar la clave directamente desde su archivo local sin mostrarla en la terminal.');
}finally{rl.close();}

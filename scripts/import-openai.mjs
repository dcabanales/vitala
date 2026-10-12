import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {env,argv,stdout} from 'node:process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=env.FLY_APP||((await readFile(path.join(root,'fly.toml'),'utf8')).match(/^app\s*=\s*"([a-z0-9-]+)"/m)?.[1]);
const pathArg=argv[2];
if(!app||!pathArg){console.error('Uso: npm run import:openai -- /ruta/al/archivo-local/.dev.vars');process.exit(2);}
const contents=await readFile(path.resolve(pathArg),'utf8');
const line=contents.split(/\r?\n/).find(x=>x.startsWith('OPENAI_API_KEY='));
const key=line?.slice('OPENAI_API_KEY='.length).trim().replace(/^(["'])(.*)\1$/,'$2');
if(!key){console.error('El archivo indicado no contiene OPENAI_API_KEY.');process.exit(2);}
const child=spawn('fly',['secrets','import','--app',app],{stdio:['pipe','inherit','inherit']});
child.on('error',e=>{console.error(`No se pudo ejecutar Fly CLI: ${e.message}`);process.exitCode=1;});
child.on('close',code=>{if(code===0)console.log('Clave de OpenAI añadida como secreto en Fly.io.');else process.exitCode=code||1;});
child.stdin.end(`OPENAI_API_KEY=${key}\nOPENAI_MODEL=gpt-6-luna\n`);

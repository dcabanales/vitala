import {currentUser,checkOrigin} from './auth';
import {storage,Storage} from './storage';
import {Patient,PatientRecord} from './model';
export async function accountContext(req:Request){if(!await currentUser())throw new Error('AUTH');if(req.method!=='GET')checkOrigin(req);return {bucket:storage,prefix:'users/owner/'};}
export async function readWorkspace(bucket:Storage,prefix:string){
 const current=await bucket.get(prefix+'patients-v2.json');
 if(current)return {patients:(await current.json<{patients:PatientRecord[]}>()).patients,etag:current.etag};
 const legacy=await bucket.get(prefix+'patient.json');return {patients:legacy?[{...await legacy.json<Patient>(),id:'legacy'}]:[],etag:null};
}
export async function context(req:Request){const account=await accountContext(req),id=new URL(req.url).searchParams.get('patientId')||'legacy';
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new Error('PATIENT');const data=await readWorkspace(account.bucket,account.prefix);
 if(!data.patients.some(p=>p.id===id))throw new Error('PATIENT');return {...account,prefix:id==='legacy'?account.prefix:account.prefix+'patients/'+id+'/'};
}
export function failure(e:unknown){const m=e instanceof Error?e.message:'';return Response.json({error:m==='AUTH'?'Inicia sesión para acceder a tus datos.':m==='ORIGIN'?'Solicitud no permitida.':m==='PATIENT'?'Selecciona un paciente válido.':m==='SIZE'?'El archivo o la solicitud supera el límite permitido.':'No se pudo completar la operación. Inténtalo de nuevo.'},{status:m==='AUTH'?401:m==='ORIGIN'?403:m==='PATIENT'?404:m==='SIZE'?413:500,headers:noCache});}
export const noCache={'Cache-Control':'no-store'};
export async function boundedRequest(req:Request,limit:number){
 if(Number(req.headers.get('content-length'))>limit)throw new Error('SIZE');const reader=req.body?.getReader();if(!reader)return req;
 const chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('SIZE');}chunks.push(value);}
 return new Request(req.url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)});
}

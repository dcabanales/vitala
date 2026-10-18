import {checkOrigin,currentUser,type User} from './auth';
import {query} from './db';
export const noCache={'Cache-Control':'no-store'};
export function problem(message:string,status:number){return Response.json({error:message},{status,headers:noCache})}
export async function requireUser(req:Request){
  const user=await currentUser();if(!user)throw new Error('AUTH');
  if(req.method!=='GET'&&req.method!=='HEAD')checkOrigin(req);
  return user;
}
export async function authorizePatient(user:User,patientId:string,write=false){
  if(!/^[0-9a-f-]{36}$/i.test(patientId))throw new Error('PATIENT');
  const r=await query(`SELECT p.id FROM patients p JOIN patient_access_grants g ON g.patient_id=p.id
    WHERE p.id=$1 AND g.user_id=$2 AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>now())
    AND ($4='admin' OR (p.patient_user_id=$2 AND p.archived_at IS NULL))
    AND ($3=false OR (g.access_level='write' AND $4='admin'))`,[patientId,user.id,write,user.role]);
  if(!r.rowCount){
    await query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,success)
      VALUES($1,'access_denied','patient',$2,false)`,[user.id,patientId]);
    throw new Error('PATIENT');
  }
  await query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id)
    VALUES($1,$2,'patient',$3,$3)`,[user.id,write?'write_access':'read',patientId]);
}
export function failure(e:unknown){
  const m=e instanceof Error?e.message:'';
  const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'';
  if(code==='23505')return problem('Ya existe un registro con esos datos.',409);
  if(['23502','23503','23514','22P02'].includes(code))return problem('Los datos o vínculos no son válidos.',400);
  if(m==='DUPLICATE')return problem('Ya existe un registro con ese nombre. Selecciónalo en el catálogo.',409);
  if(m==='AUTH')return problem('Inicia sesión para acceder.',401);
  if(m==='ORIGIN')return problem('Solicitud no permitida.',403);
  if(m==='PATIENT')return problem('Paciente no encontrado o sin acceso.',404);
  if(m==='ROLE')return problem('No tienes permiso para realizar esta acción.',403);
  if(m==='SIZE')return problem('El archivo o la solicitud supera el límite permitido.',413);
  if(m==='VALIDATION')return problem('Datos no válidos.',400);
  if(m==='PASSWORD')return problem('La contraseña debe tener entre 14 y 256 caracteres.',400);
  if(m==='IDENTITY_REVIEW')return problem('Marca cada casilla de verificación de identidad para confirmar que el documento pertenece al paciente.',409);
  if(m==='DOCUMENT_BUSY')return problem('El documento tiene una lectura en curso. Espera a que termine y vuelve a quitarlo.',409);
  if(m==='CONFLICT')return problem('Los datos han cambiado. Recarga antes de guardar.',409);
  if(m==='AI_AUTH'||m==='AI_ACCESS')return problem('La conexión con la IA necesita revisión de la clave o de sus permisos. El documento se conserva.',503);
  if(m==='AI_MODEL')return problem('El modelo de IA configurado no está disponible. Revisa la configuración; el documento se conserva.',503);
  if(m==='AI_QUOTA')return problem('La cuenta de IA no tiene cuota disponible. Revisa su facturación antes de reintentar.',503);
  if(m==='AI_REQUEST')return problem('La IA no pudo aceptar el documento o su configuración. El original se conserva para revisarlo y reintentar.',502);
  if(m==='AI_TIMEOUT')return problem('La lectura tardó demasiado. Conservamos el original; puedes reintentar.',504);
  if(m==='AI_STORAGE')return problem('No se pudo leer el archivo almacenado. El registro se conserva; reintenta o revisa el almacenamiento.',503);
  if(m==='AI_CONFIG')return problem('La lectura con IA aún no está configurada en este entorno.',503);
  if(m==='AI_BUDGET')return problem('Se alcanzó el límite diario de análisis. Inténtalo más tarde.',429);
  if(m==='AI_DOCUMENT_BUSY')return problem('Este documento ya se está leyendo. Su estado se actualizará automáticamente; no necesitas iniciar otra lectura.',429);
  if(m==='SUMMARY_BUSY')return problem('Ya se está preparando un resumen. Espera unos minutos y vuelve a intentarlo.',429);
  if(m==='SUMMARY_EMPTY')return problem('Publica datos clínicos antes de generar el resumen.',400);
  if(m==='SUMMARY_SIZE')return problem('El expediente supera el tamaño admitido para este resumen. No se ha enviado a la IA.',400);
  if(m==='PRESCRIPTION_EMPTY')return problem('La receta necesita al menos una propuesta de tratamiento o medicación. Revisa la lectura antes de confirmar.',400);
  if(m==='AI_BUSY')return problem('Ya hay dos lecturas en curso. Inténtalo de nuevo en unos minutos.',429);
  if(m==='AI_RATE')return problem('El proveedor limitó las solicitudes. Inténtalo más tarde.',429);
  if(m==='AI_PROVIDER'||m==='AI_INCOMPLETE'||m==='AI_INVALID')return problem('La lectura no se completó. Conservamos el documento para reintentar.',502);
  return problem('No se pudo completar la operación. Inténtalo de nuevo.',500);
}
export async function boundedRequest(req:Request,limit:number){
  if(Number(req.headers.get('content-length'))>limit)throw new Error('SIZE');const reader=req.body?.getReader();if(!reader)return req;
  const chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('SIZE')}chunks.push(value)}
  return new Request(req.url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)});
}

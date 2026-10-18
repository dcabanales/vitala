'use client';
import {useEffect,useState} from 'react';
export function DocumentUpload({patientId,kind,onCancel,onUploaded,personal=false}:{personal?:boolean;patientId:string;kind?:'consultation'|'examination';onCancel:()=>void;onUploaded?:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 async function upload(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{
  const data=new FormData();if(file)data.set('file',file);
  if(!(file instanceof File)||!file.size)throw Error('Selecciona un PDF o una imagen.');
  if(file.size>10*1024*1024)throw Error('El archivo supera el límite de 10 MB.');
  const tokenResponse=await fetch('/api/auth/csrf',{cache:'no-store'});if(!tokenResponse.ok)throw Error('No se pudo verificar la sesión.');
  const token=(await tokenResponse.json()).token;
  const response=await fetch(`/api/patients/${patientId}/documents`,{method:'POST',headers:{'x-csrf-token':token},body:data}),result=await response.json();
  if(!response.ok)throw Error(result.error);
  if(kind)window.location.href=`/patients/${patientId}/documents/${result.document.id}/review?kind=${kind}`;
  else{onUploaded?.();onCancel()}
 }catch(e){setError(e instanceof Error?e.message:'No se pudo subir el archivo.')}finally{setBusy(false)}}
 return <section className="v-upload"><h3>{kind==='consultation'?'Subir documento de consulta':kind==='examination'?'Subir documento de examen':'Subir documento'}</h3><p>PDF, JPG, PNG o WebP · hasta 10 MB. {kind?'Revisarás y podrás corregir los datos antes de guardarlos.':personal?'Podrás consultar el original mientras la administración revisa su contenido.':'El original queda privado; podrás leerlo con IA desde la lista.'}</p>
 {error&&<p className="error" role="alert">{error}</p>}<form className="v-form" onSubmit={upload}><label>Seleccionar PDF o imagen<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{personal&&<label>Tomar una foto<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}{file&&<div className="v-upload-preview"><strong>{file.name}</strong><p>{Math.ceil(file.size/1024)} KB</p>{file.type.startsWith('image/')?<img src={preview} alt="Vista previa del documento seleccionado"/>:<a className="v-text-link" href={preview} target="_blank" rel="noopener noreferrer">Ver PDF antes de subir</a>}</div>}{busy&&<p role="status">Subiendo y guardando tu documento…</p>}<div className="v-form-actions"><button className="v-button" disabled={busy||!file}>{busy?'Subiendo…':kind?'Subir y revisar':'Guardar original'}</button><button type="button" className="v-button v-secondary" disabled={busy} onClick={onCancel}>Cancelar</button></div></form></section>;
}
export function AddRecordAction({patientId,kind,onManual}:{patientId:string;kind:'consultation'|'examination';onManual:()=>void}){
 const [mode,setMode]=useState<'choice'|'upload'|null>(null);
 return <><div className="v-toolbar"><button type="button" className="v-button" aria-expanded={!!mode} onClick={()=>setMode(mode?null:'choice')}>Añadir {kind==='consultation'?'consulta':'examen'}</button></div>
 {mode==='choice'&&<div className="v-add-options" aria-label="Cómo añadir el registro"><button className="v-button v-secondary" type="button" onClick={()=>{setMode(null);onManual()}}>Crear manualmente</button><button type="button" className="v-button v-secondary" onClick={()=>setMode('upload')}>Subir documento y extraer con IA</button></div>}
 {mode==='upload'&&<DocumentUpload patientId={patientId} kind={kind} onCancel={()=>setMode(null)}/>}</>;
}

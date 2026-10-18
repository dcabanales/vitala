'use client';
import {useState} from 'react';
export function MedicationGuide({patientId,recordId,admin}:{patientId:string;recordId:string;admin:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[content,setContent]=useState<string|null>(null),[error,setError]=useState('');
 const endpoint='/api/patients/'+patientId+'/medications/'+recordId+'/guide';
 async function load(generate=false){setBusy(true);setError('');try{
  let headers:Record<string,string>={};if(generate){const r=await fetch('/api/auth/csrf',{cache:'no-store'});if(!r.ok)throw Error('No se pudo verificar la sesión.');headers={'x-csrf-token':(await r.json()).token}}
  const r=await fetch(endpoint,{method:generate?'POST':'GET',headers,cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error);setContent(j.guide?.content||null);setLoaded(true);
 }catch(e){setError(e instanceof Error?e.message:'No se pudo cargar la explicación.')}finally{setBusy(false)}}
 return <div className="v-medication-guide"><button type="button" className="v-link-button" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open&&!loaded)void load()}}>¿Para qué sirve?</button>{open&&<div className="v-note">{busy?<p role="status">Cargando explicación…</p>:content?<><p className="v-prose">{content}</p><small>Explicación general de IA guardada. No indica el motivo de tu prescripción ni modifica tu pauta.</small></>:<><p>Aún no hay una explicación guardada.</p>{admin&&<button className="v-button v-secondary" onClick={()=>void load(true)}>Generar explicación una vez</button>}</>}{error&&<p className="error" role="alert">{error}</p>}</div>}</div>;
}

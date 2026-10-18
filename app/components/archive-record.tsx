'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function ArchiveRecord({endpoint,payload,onSaved,returnTo}:{endpoint:string;payload:Record<string,unknown>;onSaved?:()=>void;returnTo?:string}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 async function archive(){if(!reason.trim())return;setBusy(true);setError('');try{const token=(await (await fetch('/api/auth/csrf',{cache:'no-store'})).json()).token;
 const r=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json','x-csrf-token':token},body:JSON.stringify({...payload,status:'void',changeReason:reason})}),j=await r.json();if(!r.ok)throw Error(j.error);setOpen(false);onSaved?.();if(returnTo)router.push(returnTo);router.refresh();
 }catch(e){setError(e instanceof Error?e.message:'No se pudo archivar')}finally{setBusy(false)}}
 return <div className="v-archive"><button type="button" className="v-link-button" onClick={()=>setOpen(!open)}>Archivar registro</button>{open&&<div className="v-note"><p>El registro dejará de aparecer en el expediente. Se conserva su historial y sus documentos para auditoría.</p><label>Motivo del archivo<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label><div className="v-form-actions"><button type="button" className="v-button" disabled={busy||!reason.trim()} onClick={archive}>Confirmar archivo</button><button type="button" className="v-button v-secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</button></div></div>}{error&&<p className="error" role="alert">{error}</p>}</div>;
}

'use client';
import {useState} from 'react';
export function RemoveDocument({patientId,documentId}:{patientId:string;documentId:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function remove(){setBusy(true);setError('');try{const token=(await(await fetch('/api/auth/csrf',{cache:'no-store'})).json()).token;const r=await fetch(`/api/patients/${patientId}/documents/${documentId}`,{method:'DELETE',headers:{'x-csrf-token':token}}),j=await r.json();if(!r.ok)throw Error(j.error);window.location.href=`/patients/${patientId}/documents`}catch(e){setError(e instanceof Error?e.message:'No se pudo quitar el documento')}finally{setBusy(false)}}
 return <div className="v-document-remove">{open?<><p>¿Quitar el archivo de la biblioteca? Podrás volver a cargarlo. Los datos clínicos confirmados conservarán su fuente.</p><button type="button" className="v-button v-secondary" disabled={busy} onClick={remove}>Confirmar retirada</button><button type="button" className="v-link-button" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</button></>:<button type="button" className="v-link-button" onClick={()=>setOpen(true)}>Quitar documento</button>}{error&&<p className="error" role="alert">{error}</p>}</div>;
}

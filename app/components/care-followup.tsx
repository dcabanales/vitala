'use client';
import {useState} from 'react';
export function CareFollowup({patientId,recordId,kind,initial}:{patientId:string;recordId:string;kind:'treatment'|'medication';initial:string}){
 const [state,setState]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(next:string){setBusy(true);setError('');try{const csrf=await(await fetch('/api/auth/csrf',{cache:'no-store'})).json();const r=await fetch(`/api/patients/${patientId}/care-followup`,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf.token},body:JSON.stringify({kind,recordId,state:next})});const j=await r.json();if(!r.ok)throw Error(j.error);setState(next)}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar')}finally{setBusy(false)}}
 return <div className="v-care-followup"><p>¿Se siguió {kind==='medication'?'esta medicación':'este plan'}?</p><div className="v-segments">{[['followed','Sí'],['not_followed','No'],['unknown','Sin registrar']].map(([value,label])=><button type="button" key={value} disabled={busy} aria-pressed={state===value} onClick={()=>void save(value)}>{label}</button>)}</div><small>Seguimiento general declarado; no cambia la vigencia ni la pauta.</small>{error&&<p className="error" role="alert">{error}</p>}</div>;
}

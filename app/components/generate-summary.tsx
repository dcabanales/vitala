'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function GenerateSummary({patientId,stale,hasData}:{patientId:string;stale:boolean;hasData:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 async function generate(){setBusy(true);setError('');try{
  const tokenResponse=await fetch('/api/auth/csrf',{cache:'no-store'});if(!tokenResponse.ok)throw Error('No se pudo verificar la sesión.');
  const token=(await tokenResponse.json()).token;
  const r=await fetch('/api/patients/'+patientId+'/summary',{method:'POST',headers:{'x-csrf-token':token}}),j=await r.json();if(!r.ok)throw Error(j.error);router.refresh();
 }catch(e){setError(e instanceof Error?e.message:'No se pudo generar el resumen.')}finally{setBusy(false)}}
 return <div className="v-summary-controls"><button className="v-button v-secondary" disabled={busy||!hasData} onClick={generate}>{busy?'Preparando resumen…':stale?'Actualizar resumen con IA':'Generar resumen con IA'}</button><small>Se guarda para próximas visitas. Solo se consulta la IA al pulsar este botón si han cambiado los datos.</small>{error&&<p className="error" role="alert">{error}</p>}</div>;
}

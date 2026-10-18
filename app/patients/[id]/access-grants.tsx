'use client';
import {useEffect,useState} from 'react';

type Grant={userId:string;email:string;accessLevel:string;authorizedBy:string;basis:string;revokedAt:string|null};
export function AccessGrants({patientId,currentUserId}:{patientId:string;currentUserId:string}){
  const [grants,setGrants]=useState<Grant[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function load(){
    const response=await fetch(`/api/patients/${patientId}/grants`,{cache:'no-store'});
    if(!response.ok)throw new Error('No se pudieron cargar los accesos.');
    const data=await response.json();setGrants(data.grants);
  }
  useEffect(()=>{load().catch(e=>setError(e.message))},[patientId]);
  async function revoke(grant:Grant){
    if(!window.confirm(`¿Revocar el acceso de ${grant.email} a este expediente?`))return;
    setBusy(true);setError('');
    try{
      const csrf=await fetch('/api/auth/csrf',{cache:'no-store'}).then(r=>r.json());
      const response=await fetch(`/api/patients/${patientId}/grants`,{
        method:'PATCH',headers:{'Content-Type':'application/json','x-csrf-token':csrf.token},
        body:JSON.stringify({userId:grant.userId})
      });
      if(!response.ok)throw new Error((await response.json()).error||'No se pudo revocar el acceso.');
      await load();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo revocar el acceso.')}finally{setBusy(false)}
  }
  return <section className="v-panel"><h2>Personas con acceso</h2><p className="v-muted">Los accesos revocados dejan de permitir consultar el expediente de inmediato.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="v-stack">{grants.filter(g=>!g.revokedAt).map(g=><div className="v-note" key={g.userId}>
      <strong>{g.email}</strong><p>{g.accessLevel==='write'?'Administración: lectura y edición':'Paciente: solo lectura'}</p>
      <p>Autorizado por {g.authorizedBy}. Motivo: {g.basis}</p>
      {g.userId!==currentUserId&&<button type="button" className="v-link-button" disabled={busy} onClick={()=>revoke(g)}>Revocar acceso</button>}
    </div>)}{grants.length===0&&<p className="v-muted">No hay accesos para mostrar.</p>}</div>
  </section>;
}

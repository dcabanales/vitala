'use client';
import {useState} from 'react';
export function PatientRecovery({patientId}:{patientId:string}){
  const [password,setPassword]=useState(''),[link,setLink]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function create(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');setLink('');
    try{
      const csrf=await fetch('/api/auth/csrf',{cache:'no-store'}).then(response=>response.json());
      const response=await fetch(`/api/patients/${patientId}/password-reset`,{
        method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':csrf.token},body:JSON.stringify({password})
      });
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      setLink(result.resetUrl);setPassword('');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo crear el enlace.')}finally{setBusy(false)}
  }
  return <section className="v-panel"><h2>Recuperar acceso del paciente</h2>
    <p className="v-muted">Si perdió su contraseña, genera un enlace de un solo uso. Compártelo solo por un canal privado con la persona correcta.</p>
    <form className="v-form" onSubmit={create}><label>Tu contraseña de administrador<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>
      <button className="v-button v-secondary" disabled={busy}>Generar enlace</button></form>
    {error&&<p className="error" role="alert">{error}</p>}
    {link&&<div className="v-note"><strong>Válido durante 30 minutos</strong><p className="v-break">{link}</p><button className="v-link-button" onClick={()=>navigator.clipboard.writeText(link)}>Copiar enlace</button></div>}
  </section>;
}

'use client';
import {useState} from 'react';
export function InvitePatient({patientId}:{patientId:string}){
  const [email,setEmail]=useState(''),[link,setLink]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function invite(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setLink('');try{
    const token=(await (await fetch('/api/auth/csrf',{cache:'no-store'})).json()).token;
    const r=await fetch(`/api/patients/${patientId}/invitations`,{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':token},body:JSON.stringify({email})}),j=await r.json();
    if(!r.ok)throw Error(j.error);setLink(j.invitationUrl);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo crear el enlace')}finally{setBusy(false)}}
  return <section className="v-panel"><h2>Invitar al paciente</h2><p className="v-muted">Genera un enlace de un solo uso para que cree su contraseña. Compártelo por un canal privado con la persona correcta.</p><form onSubmit={invite} className="v-form"><label>Correo del paciente<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label><button className="v-button" disabled={busy}>Crear invitación</button></form>{error&&<p className="error" role="alert">{error}</p>}{link&&<div className="v-note"><strong>Enlace válido durante 24 horas</strong><p className="v-break">{link}</p><button className="v-link-button" onClick={()=>navigator.clipboard.writeText(link)}>Copiar enlace</button></div>}</section>
}

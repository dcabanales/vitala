'use client';
import {useCallback,useEffect,useState} from 'react';
type Status={enabled:boolean;pending:boolean;recoveryRemaining:number};
type Setup={secret:string;uri:string;codes:string[]};
export function MfaSetup(){
  const [status,setStatus]=useState<Status|null>(null),[setup,setSetup]=useState<Setup|null>(null);
  const [password,setPassword]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{
    const response=await fetch('/api/auth/mfa',{cache:'no-store'});
    if(!response.ok)throw new Error('No se pudo consultar el estado de seguridad.');
    setStatus(await response.json());
  },[]);
  useEffect(()=>{load().catch(e=>setError(e.message))},[load]);
  async function csrf(){const response=await fetch('/api/auth/csrf',{cache:'no-store'});if(!response.ok)throw new Error('No se pudo verificar la solicitud.');return (await response.json()).token}
  async function start(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch('/api/auth/mfa',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':await csrf()},body:JSON.stringify({password})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setSetup(data);setPassword('');await load();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar la configuración.')}finally{setBusy(false)}
  }
  async function confirm(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch('/api/auth/mfa',{method:'PATCH',headers:{'Content-Type':'application/json','x-csrf-token':await csrf()},body:JSON.stringify({code})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setCode('');await load();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo activar la verificación.')}finally{setBusy(false)}
  }
  return <section className="v-panel"><h2>Verificación en dos pasos</h2>
    {error&&<p className="error" role="alert">{error}</p>}
    {!status&&<p className="v-muted">Consultando…</p>}
    {status?.enabled?<p className="v-note">Activa. Códigos de recuperación disponibles: {status.recoveryRemaining}.</p>:
      <><p className="v-muted">Configura una app de autenticación. Después necesitarás un código de seis dígitos al iniciar sesión como administrador.</p>
        {!setup&&<form className="v-form" onSubmit={start}><label>Contraseña actual<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>
          <button className="v-button" disabled={busy}>Generar clave y códigos</button></form>}
        {status?.pending&&!setup&&<p className="v-note">Hay una configuración pendiente. Generar otra invalida la clave y los códigos anteriores.</p>}</>}
    {setup&&<div className="v-mfa-secret"><p><strong>Guarda estos códigos ahora.</strong> Solo se muestran en esta pantalla. Cada código de recuperación funciona una vez.</p>
      <p>En tu app de autenticación, agrega una cuenta manual con esta clave:</p><code>{setup.secret}</code>
      <details><summary>Enlace de configuración para una app compatible</summary><code>{setup.uri}</code></details>
      <h3>Códigos de recuperación</h3><div className="v-code-grid">{setup.codes.map(value=><code key={value}>{value}</code>)}</div>
      {!status?.enabled&&<form className="v-form" onSubmit={confirm}><label>Código actual de seis dígitos<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event=>setCode(event.target.value)}/></label>
        <button className="v-button" disabled={busy}>Activar verificación</button></form>}
      {status?.enabled&&<p className="v-note">Verificación activada. Guarda los códigos antes de salir de esta página.</p>}
    </div>}
  </section>;
}

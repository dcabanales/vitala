import {csrfToken} from '../../lib/auth';
import {FreshCsrfForm} from '../../components/fresh-csrf-form';
export const dynamic='force-dynamic';
export default async function Invite({params}:{params:Promise<{token:string}>}){const {token}=await params;
  return <main className="login-shell"><section className="panel login-card"><a href="/" className="brand">vitala<span className="brand-dot">.</span></a><p className="eyebrow">ACCESO DE PACIENTE</p><h1>Activa tu cuenta</h1><p className="subtitle">Este enlace vence en 24 horas y solo puede usarse una vez.</p><FreshCsrfForm action="/api/auth/accept-invite" initialToken={csrfToken()}><input type="hidden" name="token" value={token}/><label>Crea una contraseña de al menos 14 caracteres<input type="password" name="password" minLength={14} maxLength={256} autoComplete="new-password" required/></label><button className="btn primary full">Activar acceso</button></FreshCsrfForm></section></main>
}

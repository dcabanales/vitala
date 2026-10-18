import {csrfToken} from '../../lib/auth';
import {FreshCsrfForm} from '../../components/fresh-csrf-form';
export const dynamic='force-dynamic';
export default async function Reset({params}:{params:Promise<{token:string}>}){const {token}=await params;
  return <main className="login-shell"><section className="panel login-card"><a href="/" className="brand">vitala<span className="brand-dot">.</span></a>
    <p className="eyebrow">RECUPERAR ACCESO</p><h1>Crea una contraseña nueva</h1>
    <p className="subtitle">Este enlace solo puede usarse una vez y vence a los 30 minutos. Se cerrarán tus otras sesiones.</p>
    <FreshCsrfForm action="/api/auth/reset-password" initialToken={csrfToken()}>
      <input type="hidden" name="token" value={token}/>
      <label>Nueva contraseña<input name="password" type="password" minLength={14} maxLength={256} autoComplete="new-password" required/></label>
      <label>Repite la contraseña<input name="repeatPassword" type="password" minLength={14} maxLength={256} autoComplete="new-password" required/></label>
      <button className="btn primary full">Guardar contraseña</button>
    </FreshCsrfForm></section></main>;
}

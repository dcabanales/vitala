import {currentUser,csrfToken} from '../lib/auth';import {redirect} from 'next/navigation';
import {FreshCsrfForm} from '../components/fresh-csrf-form';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string;reset?:string}>}){
 if(await currentUser())redirect('/');const {error,reset}=await searchParams;
 return <main className="login-shell"><section className="panel login-card"><a href="/" className="brand">vitala<span className="brand-dot">.</span></a>
 <p className="eyebrow">TU ESPACIO PRIVADO DE SALUD</p><h1>Bienvenido de nuevo</h1><p className="subtitle">Accede a tu espacio de salud y seguimiento.</p>
 {error&&<p role="alert" className="error">{error==='rate'?'Demasiados intentos. Espera 15 minutos antes de intentarlo de nuevo.':error==='reset'?'El enlace de recuperación no es válido o ya venció. Solicita uno nuevo.':'No se pudo iniciar sesión. Revisa tus datos y el código de verificación.'}</p>}
 {reset==='1'&&<p role="status" className="v-note">Contraseña actualizada. Ya puedes iniciar sesión.</p>}
 <FreshCsrfForm action="/api/auth/login" initialToken={csrfToken()}><label>Correo electrónico<input name="email" type="email" required autoComplete="username" maxLength={254}/></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password" maxLength={256}/></label><label>Código de verificación (si lo activaste)<input name="mfaCode" inputMode="numeric" autoComplete="one-time-code" maxLength={24} placeholder="6 dígitos o código de recuperación"/></label><button className="btn primary full" type="submit">Entrar a mi espacio</button></FreshCsrfForm>
 <p className="footnote">Acceso para administración y pacientes invitados.</p></section></main>
}

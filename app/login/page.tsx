import {currentUser} from '../lib/auth';import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 if(await currentUser())redirect('/');const {error}=await searchParams;
 return <main className="login-shell"><section className="panel login-card"><a href="/" className="brand">vitala<span className="brand-dot">.</span></a>
 <p className="eyebrow">TU ESPACIO PRIVADO DE SALUD</p><h1>Bienvenido de nuevo</h1><p className="subtitle">Accede a tus pacientes, documentos y seguimiento.</p>
 {error&&<p role="alert" className="error">{error==='rate'?'Demasiados intentos. Espera 15 minutos antes de intentarlo de nuevo.':'No se pudo iniciar sesión. Revisa tus datos.'}</p>}
 <form action="/api/auth/login" method="post"><label>Correo electrónico<input name="email" type="email" required autoComplete="username" maxLength={254}/></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password" maxLength={256}/></label><button className="btn primary full" type="submit">Entrar a mi espacio</button></form>
 <p className="footnote">Acceso exclusivo del propietario de este espacio.</p></section></main>
}

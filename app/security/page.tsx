import {redirect} from 'next/navigation';
import {currentUser} from '../lib/auth';
import {AppShell} from '../components/app-shell';
import {MfaSetup} from './setup';
export const dynamic='force-dynamic';
export default async function Security(){
  const user=await currentUser();if(!user)redirect('/login');if(user.role!=='admin')redirect('/patients');
  return <AppShell user={user}><main className="v-main"><p className="v-eyebrow">MI CUENTA</p><h1>Seguridad</h1>
    <p className="v-muted">La verificación en dos pasos protege el acceso de administración.</p>
    <MfaSetup/><section className="v-panel"><h2>Sesión</h2><p>Tu sesión caduca a las ocho horas.</p><a href="/logout" className="v-button v-secondary">Cerrar sesión</a></section>
  </main></AppShell>;
}

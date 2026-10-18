import {redirect} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../lib/auth';
import {landingPath} from '../lib/patient-context';
import {AppShell} from '../components/app-shell';
export const dynamic='force-dynamic';
export default async function AccessUnavailable(){
 const user=await currentUser();if(!user)redirect('/login');const destination=await landingPath(user);
 if(destination!=='/access-unavailable')redirect(destination);
 return <AppShell user={user}><main className="v-main"><p className="v-eyebrow">TU CUENTA</p><h1>Tu perfil aún no está disponible</h1><section className="v-panel"><p>No hay un perfil de salud activo vinculado a tu cuenta, o su acceso ha sido desactivado. Contacta con la persona que te invitó para revisar el acceso.</p><Link className="v-button" href="/logout">Cerrar sesión</Link></section></main></AppShell>;
}

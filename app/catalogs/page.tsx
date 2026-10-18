import {redirect} from 'next/navigation';
import {currentUser} from '../lib/auth';
import {AppShell} from '../components/app-shell';
import {CatalogManager} from './catalog-manager';
export const dynamic='force-dynamic';
export default async function Catalogs(){const user=await currentUser();if(!user)redirect('/login');if(user.role!=='admin')redirect('/patients');return <AppShell user={user}><main className="v-main"><p className="v-eyebrow">DIRECTORIO</p><h1>Catálogos médicos</h1><p className="v-muted">Profesionales, centros, condiciones, medicamentos y mediciones reutilizables.</p><CatalogManager/></main></AppShell>}

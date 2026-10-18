import {csrfToken} from '../lib/auth';
import {FreshCsrfForm} from '../components/fresh-csrf-form';
export const dynamic='force-dynamic';
export default function Logout(){return <main className="login-shell"><section className="panel login-card"><h1>Cerrar sesión</h1><p>Los registros permanecerán guardados en tu espacio.</p><FreshCsrfForm action="/api/auth/logout" initialToken={csrfToken()}><button className="btn primary full">Cerrar sesión</button></FreshCsrfForm><a className="btn light full" href="/">Volver a Vitala</a></section></main>}

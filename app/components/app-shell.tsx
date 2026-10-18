import {Icon} from './health-icon';
import Link from 'next/link';
import {type User} from '../lib/auth';
import {personalPatientId} from '../lib/patient-context';
import {WorkspaceNav} from './workspace-nav';
export async function AppShell({user,children}:{user:User;children:React.ReactNode}){
 const personalId=await personalPatientId(user),home=user.role==='admin'?'/patients':personalId?`/patients/${personalId}`:'/access-unavailable';
 return <div className="v-app"><a className="v-skip" href="#main-content">Saltar al contenido</a>
  <header className="v-header"><Link href={home} className="v-brand">vitala<span>.</span></Link><span className="v-private">Un lugar para cuidarte</span><Link href={user.role==='admin'?'/security':'/logout'} className="v-account">{user.email}</Link></header>
  <div className="v-frame"><aside className="v-side"><p className="v-nav-label">TU ESPACIO</p><WorkspaceNav admin={user.role==='admin'} patientId={personalId}/><div className="v-side-bottom"><span className="v-sidebar-symbol"><Icon name="leaf" size={25}/></span><p>Cada historia de salud<br/>merece su espacio.</p><Link href="/logout" className="v-link-button">Cerrar sesión</Link></div></aside><div className="v-content" id="main-content">{children}</div></div>
  <WorkspaceNav admin={user.role==='admin'} patientId={personalId} mobile/>
 </div>;
}

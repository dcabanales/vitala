import {redirect} from 'next/navigation';
import {currentUser} from '../lib/auth';
import {AppShell} from '../components/app-shell';
import {landingPath} from '../lib/patient-context';
import {PatientList} from './patient-list';
export const dynamic='force-dynamic';
export default async function Patients(){const user=await currentUser();if(!user)redirect('/login');if(user.role!=='admin')redirect(await landingPath(user));return <AppShell user={user}><main className="v-main"><div className="v-title"><div><p className="v-eyebrow">EXPEDIENTES</p><h1>Pacientes</h1><p>Consulta y organiza la información médica documentada.</p></div></div><PatientList role={user.role}/></main></AppShell>}

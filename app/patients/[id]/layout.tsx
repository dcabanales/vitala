import {redirect,notFound} from 'next/navigation';
import {currentUser} from '../../lib/auth';
import {authorizePatient} from '../../lib/server';
import {query} from '../../lib/db';
import {AppShell} from '../../components/app-shell';
import {PatientNavigation} from './patient-navigation';
export default async function PatientLayout({params,children}:{params:Promise<{id:string}>;children:React.ReactNode}){
 const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
 try{await authorizePatient(user,id)}catch{notFound()}
 const p=(await query<{id:string;name:string;birthDate:string|null;bloodGroup:string|null;archivedAt:string|null}>('SELECT id,name,birth_date AS "birthDate",blood_group AS "bloodGroup",archived_at AS "archivedAt" FROM patients WHERE id=$1',[id])).rows[0];if(!p)notFound();
 return <AppShell user={user}><div className="v-patient-workspace"><PatientNavigation patient={p} personal={user.role==='patient'}/>{children}</div></AppShell>;
}

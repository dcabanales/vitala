import {redirect,notFound} from 'next/navigation';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {MedicationList} from '../treatments/medication-list';
export const dynamic='force-dynamic';
export default async function Medications({params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
 try{await authorizePatient(user,id)}catch{notFound()}
 return <main className="v-main"><p className="v-eyebrow">MI CUIDADO</p><h1>{user.role==='patient'?'Mis medicamentos':'Medicación'}</h1><MedicationList patientId={id} role={user.role}/></main>;
}

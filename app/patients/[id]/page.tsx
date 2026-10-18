import {redirect,notFound} from 'next/navigation';
import {currentUser} from '../../lib/auth';
import {authorizePatient} from '../../lib/server';
import {PatientSummary} from './patient-summary';
export const dynamic='force-dynamic';
export default async function PatientPage({params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
 try{await authorizePatient(user,id)}catch{notFound()}
 return <main className="v-main v-overview"><PatientSummary patientId={id} role={user.role}/></main>;
}

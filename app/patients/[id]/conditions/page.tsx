import {redirect,notFound} from 'next/navigation';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {ClinicalFacts} from '../clinical-facts';
export const dynamic='force-dynamic';
export default async function Conditions({params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
 try{await authorizePatient(user,id)}catch{notFound()}
 return <main className="v-main"><h1>Condiciones y alergias</h1><p className="v-muted">Enfermedades, alergias y antecedentes documentados del paciente.</p><ClinicalFacts patientId={id} role={user.role}/></main>;
}

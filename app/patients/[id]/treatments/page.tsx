import {SectionTabs} from '../../../components/section-tabs';
import {redirect,notFound} from 'next/navigation';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {query} from '../../../lib/db';
import {TreatmentList} from './treatment-list';
import {MedicationList} from './medication-list';
export const dynamic='force-dynamic';
export default async function Treatments({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
  try{await authorizePatient(user,id)}catch{notFound()}
  const r=await query<{name:string}>('SELECT name FROM patients WHERE id=$1',[id]);if(!r.rows[0])notFound();
  return <main className="v-main"><p className="v-eyebrow">SEGUIMIENTO</p><h1>Tratamientos</h1><p className="v-muted">Tus tratamientos y medicamentos, con sus indicaciones y fechas de seguimiento.</p><SectionTabs sections={[{id:"planes",label:"Planes de cuidado",content:<TreatmentList patientId={id} role={user.role}/>},{id:"medicinas",label:"Medicamentos",content:<MedicationList patientId={id} role={user.role}/>}]} /></main>
}

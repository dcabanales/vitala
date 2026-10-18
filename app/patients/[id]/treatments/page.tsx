import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
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
  return <main className="v-main"><p className="v-eyebrow">SEGUIMIENTO</p><h1>Tratamientos</h1><p className="v-muted">Planes y pautas documentadas. El estado refleja lo registrado, sin suponer vigencia cuando falta información.</p>{user.role==='admin'&&<p className="v-reading-note">Si el tratamiento figura en un informe, <Link className="v-text-link" href={`/patients/${id}/consultations`}>añade la consulta desde su documento</Link> y registra aquí el plan revisado.</p>}<TreatmentList patientId={id} role={user.role}/><MedicationList patientId={id} role={user.role}/></main>
}

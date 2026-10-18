import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {query} from '../../../lib/db';
import {ExamsAndMeasurements} from './exams-and-measurements';
export const dynamic='force-dynamic';
export default async function Exams({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
  try{await authorizePatient(user,id)}catch{notFound()}
  const r=await query<{name:string}>('SELECT name FROM patients WHERE id=$1',[id]);if(!r.rows[0])notFound();
  return <main className="v-main"><p className="v-eyebrow">RESULTADOS</p><h1>Exámenes y mediciones</h1><p className="v-muted">Conserva los valores, unidades y rangos tal como aparecen en la fuente.</p><ExamsAndMeasurements patientId={id} role={user.role}/></main>
}

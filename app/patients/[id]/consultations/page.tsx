import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {query} from '../../../lib/db';
import {ConsultationList} from './consultation-list';
export const dynamic='force-dynamic';
export default async function Consultations({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
  try{await authorizePatient(user,id)}catch{notFound()}
  const r=await query<{name:string}>('SELECT name FROM patients WHERE id=$1',[id]);if(!r.rows[0])notFound();
  return <main className="v-main"><p className="v-eyebrow">ATENCIÓN MÉDICA</p><h1>Consultas</h1><p className="v-muted">Cada consulta conserva el contexto, profesional, centro y conclusiones documentadas.</p><ConsultationList patientId={id} role={user.role}/></main>
}

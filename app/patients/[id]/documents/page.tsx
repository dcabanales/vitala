import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {query} from '../../../lib/db';
import {DocumentList} from './document-list';
export const dynamic='force-dynamic';
export default async function Documents({params,searchParams}:{searchParams:Promise<{upload?:string}>;params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
  try{await authorizePatient(user,id)}catch{notFound()}
  const r=await query<{name:string}>('SELECT name FROM patients WHERE id=$1',[id]);if(!r.rows[0])notFound();
  return <main className="v-main"><p className="v-eyebrow">FUENTES</p><h1>{user.role==='patient'?'Mis documentos':'Documentos'}</h1><p className="v-muted">Conserva los PDF e imágenes originales junto a los datos extraídos.</p><DocumentList patientId={id} role={user.role} initiallyOpen={(await searchParams).upload==='1'}/></main>
}

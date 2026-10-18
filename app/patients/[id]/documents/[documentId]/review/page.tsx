import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../../../../../lib/auth';
import {authorizePatient} from '../../../../../lib/server';
import {query} from '../../../../../lib/db';
import {ExtractionReview} from './review';
export const dynamic='force-dynamic';
export default async function Review({params,searchParams}:{params:Promise<{id:string;documentId:string}>;searchParams:Promise<{kind?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');const {id,documentId}=await params;
  try{await authorizePatient(user,id,true)}catch{notFound()}
  const doc=await query<{file_name:string;mime_type:string}>(`SELECT file_name,mime_type FROM medical_documents WHERE patient_id=$1 AND id=$2 AND status='ready'`,[id,documentId]);
  if(!doc.rowCount)notFound();
  const kind=(await searchParams).kind==='examination'?'examination':'consultation';
  return <main className="v-main"><Link href={`/patients/${id}/documents`} className="v-back">← Documentos</Link><p className="v-eyebrow">LECTURA ASISTIDA</p><h1>Revisar extracción</h1><p className="v-muted">{doc.rows[0].file_name}</p><ExtractionReview patientId={id} documentId={documentId} initialKind={kind} fileName={doc.rows[0].file_name} mimeType={doc.rows[0].mime_type}/></main>
}

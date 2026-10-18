import {redirect,notFound} from 'next/navigation';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {Assistant} from './assistant';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const user=await currentUser();if(!user)redirect('/login');const {id}=await params;try{await authorizePatient(user,id)}catch{notFound()}return <main className="v-main"><p className="v-eyebrow">ENTIENDE TU SALUD</p><h1>Tu asistente de salud</h1><p className="v-muted">Explicaciones sencillas sobre medicamentos, enfermedades y tus informes publicados. Información educativa generada con IA; no sustituye una consulta médica.</p><Assistant patientId={id}/></main>}

import {redirect,notFound} from 'next/navigation';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {PendingList} from './pending-list';
export const dynamic='force-dynamic';
export default async function Pending({params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)redirect('/login');const {id}=await params;try{await authorizePatient(user,id)}catch{notFound()}
 return <main className="v-main"><p className="v-eyebrow">PRÓXIMOS PASOS</p><h1>Consultas y exámenes pendientes</h1><p className="v-muted">Lo que falta por hacer, con o sin fecha. Programa una cita cuando la tengas y marca lo realizado para mantener el seguimiento al día.</p><PendingList patientId={id} admin={user.role==='admin'}/></main>;
}

import Link from 'next/link';
import {query} from '../lib/db';
import {friendlyDate} from '../lib/labels';
import {SectionTitle} from './reading';
export async function PendingSummary({patientId}:{patientId:string}){
 const items=(await query<{id:string;title:string;kind:string;scheduled_date:string|null}>(`SELECT id,title,kind,scheduled_date FROM care_tasks WHERE patient_id=$1 AND status='pending' ORDER BY scheduled_date ASC NULLS LAST,created_at DESC LIMIT 3`,[patientId])).rows;
 return <section className="v-pending-summary"><SectionTitle icon="clock" title="Tus próximos pasos"/>{items.length?items.map(t=><Link className="v-pending-preview" key={t.id} href={'/patients/'+patientId+'/pending'}><strong>{t.title}</strong><small>{t.kind==='consultation'?'Consulta':'Examen'} · {t.scheduled_date?friendlyDate(t.scheduled_date):'Por programar'}</small></Link>):<p className="v-muted">No hay consultas ni exámenes pendientes.</p>}<Link className="v-text-link" href={'/patients/'+patientId+'/pending'}>Ver consultas y exámenes pendientes →</Link></section>;
}

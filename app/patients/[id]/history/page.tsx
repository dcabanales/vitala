import {StatusLabel,RecordLabel} from '../../../components/status-label';
import {DateMark} from '../../../components/reading';
import {Icon} from '../../../components/health-icon';
import {clinicalDate,friendlyDate} from '../../../lib/labels';
import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {query} from '../../../lib/db';

export const dynamic='force-dynamic';
type Event={withdrawn:boolean;id:string;kind:string;title:string;detail:string|null;eventDate:string|null;specialty:string|null;status:string};
const names:Record<string,string>={consultation:'Consulta',examination:'Examen',treatment:'Tratamiento',history:'Antecedente',document:'Documento'};
function dateParam(raw:string|undefined){return raw&&/^\d{4}-\d{2}-\d{2}$/.test(raw)&&!Number.isNaN(Date.parse(raw))?raw:null}
export default async function History({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{kind?:string;from?:string;to?:string;specialty?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  const {id}=await params;try{await authorizePatient(user,id)}catch{notFound()}
  const p=(await query<{name:string}>('SELECT name FROM patients WHERE id=$1',[id])).rows[0];if(!p)notFound();
  const filters=await searchParams;
  const kind=Object.hasOwn(names,filters.kind||'')?filters.kind:null;
  const from=dateParam(filters.from),to=dateParam(filters.to);
  const specialty=filters.specialty&&/^[0-9a-f-]{36}$/i.test(filters.specialty)?filters.specialty:null;
  const specialties=await query<{id:string;name:string}>('SELECT id,name FROM medical_specialties WHERE active ORDER BY name');
  const events=await query<Event>(`SELECT id,kind,title,detail,event_date AS "eventDate",specialty,status,(kind='document' AND EXISTS(SELECT 1 FROM medical_documents removed WHERE removed.id=timeline.id AND removed.archived_at IS NOT NULL)) AS withdrawn FROM (
    SELECT c.id,'consultation'::text AS kind,'Consulta médica'::text AS title,
      COALESCE(NULLIF(c.summary,''),NULLIF(c.reason,'')) AS detail,c.event_date,
      COALESCE(s.name,c.specialty_as_documented) AS specialty,c.specialty_id,c.status,c.created_at
      FROM consultations c LEFT JOIN medical_specialties s ON s.id=c.specialty_id WHERE c.patient_id=$1
    UNION ALL
    SELECT e.id,'examination',e.name,COALESCE(NULLIF(e.conclusion,''),NULLIF(e.findings,'')),e.event_date,
      COALESCE(s.name,e.specialty_as_documented),e.specialty_id,e.status,e.created_at
      FROM examinations e LEFT JOIN medical_specialties s ON s.id=e.specialty_id WHERE e.patient_id=$1
    UNION ALL
    SELECT t.id,'treatment',t.name,t.indication,t.start_date,NULL,NULL::uuid,t.status,t.created_at
      FROM treatments t WHERE t.patient_id=$1
    UNION ALL
    SELECT h.id,'history',h.title,h.detail,h.documented_date,NULL,NULL::uuid,h.status,h.created_at
      FROM medical_history_events h WHERE h.patient_id=$1
    UNION ALL
    SELECT d.id,'document',d.file_name,NULL,d.document_date,s.name,d.specialty_id,
      CASE WHEN d.visible_to_patient THEN 'published' ELSE 'draft' END,d.created_at
      FROM medical_documents d LEFT JOIN medical_specialties s ON s.id=d.specialty_id
      WHERE d.patient_id=$1 AND d.status='ready'
  ) timeline WHERE status<>'void' AND ($2='admin' OR status='published')
    AND ($3::text IS NULL OR kind=$3) AND ($4::date IS NULL OR event_date>=$4)
    AND ($5::date IS NULL OR event_date<=$5) AND ($6::uuid IS NULL OR specialty_id=$6)
    ORDER BY event_date DESC NULLS LAST,created_at DESC LIMIT 200`,
    [id,user.role,kind,from,to,specialty]);
  const href=(event:Event)=>{
    const root=`/patients/${id}`;
    return event.kind==='consultation'?`${root}/consultations/${event.id}`:
      event.kind==='examination'?`${root}/exams/${event.id}`:
      event.kind==='treatment'?`${root}/treatments`:
      event.kind==='document'?`${root}/documents`:
      root+'/conditions#antecedentes';
  };
  return <main className="v-main">
    <p className="v-eyebrow">HISTORIA DOCUMENTADA</p><h1>Tu historia de salud</h1>
    <p className="v-muted">Eventos por fecha clínica. Los registros sin fecha aparecen al final.</p>
    <form className="v-report-controls" method="get"><label>Tipo<select name="kind" defaultValue={kind||''}><option value="">Todos</option>{Object.entries(names).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Desde<input type="date" name="from" defaultValue={from||''}/></label><label>Hasta<input type="date" name="to" defaultValue={to||''}/></label>
      <label>Especialidad<select name="specialty" defaultValue={specialty||''}><option value="">Todas</option>{specialties.rows.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
      <button className="v-button v-secondary">Aplicar filtros</button></form>
    {!events.rowCount&&<div className="v-empty"><p>No hay eventos documentados para estos filtros.</p></div>}
    <div className="v-timeline">{events.rows.map(event=><Link href={href(event)} className="v-timeline-item" key={event.kind+event.id}>
      <DateMark date={event.eventDate}/><div><small>{event.eventDate?friendlyDate(event.eventDate):'Fecha no documentada'} · {names[event.kind]}</small><div className="v-labels">{event.withdrawn?<StatusLabel>Documento retirado</StatusLabel>:event.status==='draft'?<RecordLabel status={event.status}/>:null}</div>
      <h2>{event.title}</h2>{event.withdrawn&&<p className="v-muted">Retirado de la biblioteca. Se conserva esta referencia histórica.</p>}{event.specialty&&<p>{event.specialty}</p>}{event.detail&&<p className="v-muted v-line-clamp">{event.detail}</p>}</div><Icon name="arrow" size={18}/>
    </Link>)}</div>
  </main>;
}

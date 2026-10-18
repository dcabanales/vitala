import {savedClinicalItems} from '../../../../lib/saved-clinical-items';
import {SavedClinicalRecords} from '../../../../components/saved-clinical-records';
import {ReadingText} from '../../../../components/reading';
import {Icon} from '../../../../components/health-icon';
import {DocumentPreview} from '../../../../components/document-preview';
import {clinicalDate,friendlyDate} from '../../../../lib/labels';
import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../../../../lib/auth';
import {authorizePatient} from '../../../../lib/server';
import {query} from '../../../../lib/db';
import {ConsultationEditor} from './consultation-editor';
export const dynamic='force-dynamic';
type Consultation={id:string;patient_id:string;event_date:string|null;doctor_name:string|null;center_name:string|null;specialty_name:string|null;reason:string|null;symptoms:string|null;summary:string|null;findings:string|null;impression:string|null;conclusion:string|null;recommendations:string|null;follow_up:string|null;status:string;version:number};
export default async function ConsultationDetail({params}:{params:Promise<{id:string;consultationId:string}>}){
  const user=await currentUser();if(!user)redirect('/login');const {id,consultationId}=await params;
  try{await authorizePatient(user,id)}catch{notFound()}
  const r=await query<Consultation>(`SELECT c.*,COALESCE(c.doctor_as_documented,d.name) AS doctor_name,
    COALESCE(c.center_as_documented,m.name) AS center_name,COALESCE(c.specialty_as_documented,s.name) AS specialty_name FROM consultations c
    LEFT JOIN doctors d ON d.id=c.doctor_id LEFT JOIN medical_centers m ON m.id=c.center_id
    LEFT JOIN medical_specialties s ON s.id=c.specialty_id
    WHERE c.patient_id=$1 AND c.id=$2 AND ($3='admin' OR c.status='published') AND c.status<>'void'`,[id,consultationId,user.role]);
  const c=r.rows[0];if(!c)notFound();
  const sources=await query<{id:string;file_name:string;withdrawn:boolean;mime_type:string}>(`SELECT d.id,d.file_name,d.mime_type,(d.archived_at IS NOT NULL) AS withdrawn FROM consultation_documents cd
    JOIN medical_documents d ON d.id=cd.document_id AND d.patient_id=cd.patient_id
    WHERE cd.patient_id=$1 AND cd.consultation_id=$2 AND d.status='ready' AND ($3='admin' OR d.visible_to_patient)
    ORDER BY d.created_at`,[id,consultationId,user.role]);
  const related=await query<{id:string;name:string}>(`SELECT id,name FROM treatments WHERE patient_id=$1 AND consultation_id=$2 AND status<>'void' AND ($3='admin' OR status='published')`,[id,consultationId,user.role]);
  const relatedExams=await query<{id:string;name:string}>("SELECT id,name FROM examinations WHERE patient_id=$1 AND consultation_id=$2 AND status<>'void' AND ($3='admin' OR status='published') ORDER BY event_date DESC NULLS LAST",[id,consultationId,user.role]);
  const savedItems=await savedClinicalItems(id,user.role,{consultationId});
  const extra=[['Motivo de consulta',c.reason],['Síntomas registrados',c.symptoms],['Hallazgos',c.findings],['Impresión diagnóstica documentada',c.impression]].filter(([,value])=>value);
  return <main className="v-main v-reading-page"><Link href={`/patients/${id}/consultations`} className="v-back">← Todas las consultas</Link><header className="v-record-header"><span className="v-category">{c.status==='draft'?'Borrador privado':'Consulta'} · {friendlyDate(c.event_date)||'Fecha no registrada'}</span><h1>{c.specialty_name||'Consulta médica'}</h1><div className="v-provider-line"><span><Icon name="user" size={17}/>{c.doctor_name||'Doctor sin registrar'}</span><span><Icon name="visit" size={17}/>{c.center_name||'Centro sin registrar'}</span></div></header>
  <div className="v-reading-layout"><article className="v-reading-article"><section className="v-reading-lead"><span className="v-category">LO QUE QUEDÓ REGISTRADO</span><h2>El resumen de tu consulta</h2><ReadingText text={c.summary||'Esta consulta todavía no tiene un resumen documentado.'} limit={650}/></section>{c.conclusion&&<section className="v-reading-block"><h2>Conclusión de la consulta</h2><ReadingText text={c.conclusion} limit={500}/></section>}{extra.length>0&&<details className="v-disclosure v-clinical-detail"><summary>Explorar los detalles clínicos <span>＋</span></summary>{extra.map(([label,value])=><section className="v-reading-block" key={label}><h3>{label}</h3><ReadingText text={value} limit={500}/></section>)}</details>}
  {(c.recommendations||c.follow_up)&&<section className="v-next-steps"><div className="v-icon-title"><Icon name="care"/><h2>Indicaciones y seguimiento</h2></div><p className="v-form-note">Tal como fueron documentados en la consulta.</p>{c.recommendations&&<ReadingText text={c.recommendations} limit={500}/>} {c.follow_up&&<><h3>Seguimiento</h3><ReadingText text={c.follow_up}/></>}</section>}<SavedClinicalRecords items={savedItems}/></article>
  <aside className="v-record-aside">{relatedExams.rows.length>0&&<section><h2>Exámenes relacionados</h2>{relatedExams.rows.map(e=><Link className="v-related-link" key={e.id} href={'/patients/'+id+'/exams/'+e.id}>{e.name} →</Link>)}</section>}{sources.rows.length>0&&<section><h2>Documentos de esta consulta</h2>{sources.rows.map(source=><DocumentPreview key={source.id} name={source.file_name} mime={source.mime_type} withdrawn={source.withdrawn} href={`/api/patients/${id}/documents/${source.id}`}/>)}</section>}{related.rows.length>0&&<section><h2>Tratamientos relacionados</h2>{related.rows.map(t=><Link className="v-related-link" href={`/patients/${id}/treatments#${t.id}`} key={t.id}><Icon name="care"/>{t.name}<Icon name="arrow" size={16}/></Link>)}</section>}<p className="v-reading-note">Este contenido recoge lo documentado en la consulta. Abre las fuentes para contrastar los detalles.</p></aside></div>
  {user.role==='admin'&&<div className="v-admin-area"><p className="v-category">GESTIONAR ESTE REGISTRO</p><ConsultationEditor patientId={id} consultationId={c.id} version={c.version} status={c.status} summary={c.summary||''} conclusion={c.conclusion||''} values={{...c,eventDate:c.event_date,followUp:c.follow_up}}/></div>}</main>;
}

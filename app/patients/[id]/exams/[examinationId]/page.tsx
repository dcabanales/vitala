import {examinationFingerprint,interpretationSchema} from '../../../../lib/examination-interpretation';
import {ResultEditor,GenerateInterpretation} from './result-editor';
import {ReadingText} from '../../../../components/reading';
import {Icon} from '../../../../components/health-icon';
import {DocumentPreview} from '../../../../components/document-preview';
import {clinicalDate,friendlyDate} from '../../../../lib/labels';
import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../../../../lib/auth';
import {authorizePatient} from '../../../../lib/server';
import {query} from '../../../../lib/db';
import {ExaminationEditor} from './examination-editor';

export const dynamic='force-dynamic';
type Exam={doctor_id:string|null;center_id:string|null;specialty_id:string|null;id:string;name:string;event_date:string|null;specialty_name:string|null;doctor_name:string|null;center_name:string|null;
  indication:string|null;findings:string|null;conclusion:string|null;status:string;version:number};
type Measure={id:string;version:number;status:string;name_as_documented:string|null;type_name:string;original_value:string;numeric_value:string|null;text_value:string|null;code_value:string|null;value_kind:string;components:Record<string,string>|null;comparator:string|null;unit:string|null;reference_range:string|null};
type Source={id:string;file_name:string;mime_type:string};
export default async function ExaminationDetail({params}:{params:Promise<{id:string;examinationId:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  const {id,examinationId}=await params;try{await authorizePatient(user,id)}catch{notFound()}
  const exam=await query<Exam>(`SELECT e.doctor_id,e.center_id,e.specialty_id,e.id,e.name,e.event_date,e.indication,e.findings,e.conclusion,e.status,e.version,
    COALESCE(e.specialty_as_documented,s.name) AS specialty_name,
    COALESCE(e.doctor_as_documented,d.name) AS doctor_name,
    COALESCE(e.center_as_documented,c.name) AS center_name
    FROM examinations e LEFT JOIN medical_specialties s ON s.id=e.specialty_id
    LEFT JOIN doctors d ON d.id=e.doctor_id LEFT JOIN medical_centers c ON c.id=e.center_id
    WHERE e.patient_id=$1 AND e.id=$2 AND e.status<>'void' AND ($3='admin' OR e.status='published')`,
    [id,examinationId,user.role]);
  const e=exam.rows[0];if(!e)notFound();
  const [measurements,sources,interpretations]=await Promise.all([
    query<Measure>(`SELECT m.*,t.name AS type_name
      FROM measurements m JOIN measurement_types t ON t.id=m.type_id
      WHERE m.patient_id=$1 AND m.examination_id=$2 AND m.status<>'void' AND ($3='admin' OR m.status='published')
      ORDER BY m.created_at,m.id`,[id,examinationId,user.role]),
    query<Source>(`SELECT d.id,d.file_name,d.mime_type FROM examination_documents ed
      JOIN medical_documents d ON d.id=ed.document_id AND d.patient_id=ed.patient_id
      WHERE ed.patient_id=$1 AND ed.examination_id=$2 AND d.status='ready' AND ($3='admin' OR d.visible_to_patient)
      ORDER BY d.created_at`,[id,examinationId,user.role]),
    query<{content:unknown;source_hash:string;created_at:Date}>(`SELECT content,source_hash,created_at FROM examination_interpretations WHERE patient_id=$1 AND examination_id=$2 AND status='completed' ORDER BY created_at DESC LIMIT 10`,[id,examinationId])
  ]);
  const fingerprint=examinationFingerprint(e,measurements.rows.filter(m=>m.status==='published'));
  const saved=interpretations.rows.find(x=>x.source_hash===fingerprint);
  const parsed=interpretationSchema.safeParse(saved?.content),explanation=parsed.success?parsed.data:null;
  const needsExplanation=!e.findings?.trim()||!e.conclusion?.trim()||!e.indication?.trim();
  return <main className="v-main v-reading-page"><Link href={`/patients/${id}/exams`} className="v-back">← Todos los resultados</Link><header className="v-record-header"><span className="v-category">{e.status==='draft'?'Borrador privado':'Examen'} · {friendlyDate(e.event_date)||'Fecha no registrada'}</span><h1>{e.name}</h1><div className="v-provider-line"><span><Icon name="user" size={17}/>{e.doctor_name||'Doctor sin registrar'}</span><span><Icon name="visit" size={17}/>{e.center_name||'Centro sin registrar'}</span><span>{e.specialty_name||'Especialidad sin registrar'}</span></div></header>
 <div className="v-reading-layout"><article className="v-reading-article"><section className="v-reading-lead"><span className="v-category">LO QUE DICE EL INFORME</span><h2>Conclusión documentada</h2><ReadingText text={e.conclusion||'El informe no tiene una conclusión registrada.'} limit={650}/></section>{e.findings&&<section className="v-reading-block"><h2>Hallazgos del examen</h2><ReadingText text={e.findings} limit={500}/></section>}{e.indication&&<details className="v-disclosure"><summary>¿Por qué se realizó este examen? <span>＋</span></summary><ReadingText text={e.indication}/></details>}
 {measurements.rows.length>0&&<section className="v-health-section"><div className="v-section-head"><h2>Resultados individuales</h2>{user.role==='admin'&&<a className="v-text-link" href="#corregir-resultados">Corregir resultados</a>}</div><p className="v-section-description">Valores y referencias tal como constan en la fuente, sin clasificación automática.</p><div className="v-result-grid">{measurements.rows.map(m=><article className="v-result-item" key={m.id}><h3>{m.name_as_documented||m.type_name}</h3><strong>{m.original_value}</strong><p>Unidad: {m.unit||'No registrada'}</p><p className="v-reference">Referencia del informe: {m.reference_range||'No registrada'}</p></article>)}</div><Link className="v-text-link" href={`/patients/${id}/exams#mediciones`}>Explorar la evolución de las mediciones <Icon name="arrow" size={16}/></Link></section>}
 {needsExplanation&&<section className="v-reading-block v-ai-explanation"><span className="v-category">INTERPRETACIÓN DE IA · NO ES UNA CONCLUSIÓN DEL MÉDICO</span><h2>Una explicación de tus resultados</h2><p className="v-section-description">Orientación generada por IA a partir de los datos registrados. Puede contener errores y no sustituye la valoración del profesional.</p>{explanation?<>{!e.findings?.trim()&&<><h3>Observaciones de IA</h3><ReadingText text={explanation.findings}/></>}{!e.conclusion?.trim()&&<><h3>Resumen orientativo de IA</h3><ReadingText text={explanation.conclusion}/></>}{!e.indication?.trim()&&<><h3>Orientación general de IA</h3><ReadingText text={explanation.guidance}/><p className="v-reading-note">El motivo y las indicaciones del examen no constan en el informe. Esta orientación no es una prescripción.</p></>}</>:<p>{interpretations.rows.length?'La explicación anterior ya no corresponde a los datos actuales.':'Todavía no se ha generado una explicación para este examen.'}</p>}{user.role==='admin'&&!explanation&&<GenerateInterpretation patientId={id} examinationId={examinationId} stale={interpretations.rows.length>0}/>}</section>}
 </article>
 <aside className="v-record-aside">{sources.rows.length>0&&<section><h2>Documentos de este examen</h2>{sources.rows.map(source=><DocumentPreview key={source.id} name={source.file_name} mime={source.mime_type} href={`/api/patients/${id}/documents/${source.id}`}/>)}</section>}<p className="v-reading-note">Cada resultado conserva la unidad y la referencia de su informe. Su interpretación depende del contexto clínico.</p></aside></div>
 {user.role==='admin'&&<div className="v-admin-area"><p className="v-category">GESTIONAR ESTE REGISTRO</p>{measurements.rows.length>0&&<ResultEditor patientId={id} results={measurements.rows.map(m=>({id:m.id,version:m.version,nameAsDocumented:m.name_as_documented||m.type_name,originalValue:m.original_value,numericValue:m.numeric_value,textValue:m.text_value,codeValue:m.code_value,valueKind:m.value_kind,components:m.components,comparator:m.comparator,unit:m.unit,referenceRange:m.reference_range,status:m.status}))}/>}<ExaminationEditor patientId={id} examinationId={examinationId} values={{doctorId:e.doctor_id,centerId:e.center_id,specialtyId:e.specialty_id,name:e.name,eventDate:e.event_date,indication:e.indication,findings:e.findings,conclusion:e.conclusion,status:e.status,version:e.version}}/></div>}</main>;
}

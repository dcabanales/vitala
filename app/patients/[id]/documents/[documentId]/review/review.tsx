'use client';
import {ClinicalFields,consultationFields as sharedConsultationFields,examinationFields as sharedExaminationFields} from '../../../../../components/clinical-fields';
import type {IdentityIssue} from '../../../../../lib/document-identity';
import {useCallback,useEffect,useState} from 'react';
type Evidence={field:string;page:string|null;quote:string};
type ConsultationDraft={patientName:string|null;patientBirthDate?:string|null;patientIdentifier?:string|null;eventDate:string|null;doctorName:string|null;centerName:string|null;specialtyName:string|null;
  reason:string|null;symptoms:string|null;summary:string|null;findings:string|null;impression:string|null;conclusion:string|null;
  recommendations:string|null;followUp:string|null;evidence:Evidence[]};
type Measurement={typeName:string;originalValue:string;numericValue:string|null;unit:string|null;referenceRange:string|null};
type ExaminationDraft={patientName:string|null;patientBirthDate?:string|null;patientIdentifier?:string|null;name:string|null;eventDate:string|null;doctorName:string|null;centerName:string|null;
  specialtyName:string|null;indication:string|null;findings:string|null;conclusion:string|null;measurements:Measurement[];evidence:Evidence[]};
type Run={identityIssues?:IdentityIssue[];originalDraft?:{patientName?:string|null;patientBirthDate?:string|null;patientIdentifier?:string|null};id:string;kind:'consultation'|'examination';status:string;draft:ConsultationDraft|ExaminationDraft|null;
  warning:string|null;errorCode:string|null;consultationId:string|null;examinationId:string|null};
type MeasurementType={id:string;name:string;valueKind:string;defaultUnit:string|null};
export function ExtractionReview({patientId,documentId,initialKind}:{patientId:string;documentId:string;initialKind:'consultation'|'examination'}){
  const [run,setRun]=useState<Run|null>(null),[consultation,setConsultation]=useState<ConsultationDraft|null>(null);
  const [examination,setExamination]=useState<ExaminationDraft|null>(null),[types,setTypes]=useState<MeasurementType[]>([]);
  const [typeIds,setTypeIds]=useState<(string|null)[]>([]),[kindChoice,setKindChoice]=useState<'consultation'|'examination'>(initialKind);
  const [acknowledged,setAcknowledged]=useState<string[]>([]),[identityReason,setIdentityReason]=useState(''),[reviewed,setReviewed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const base=`/api/patients/${patientId}/documents/${documentId}/analyze`;
  const loadTypes=useCallback(async()=>{const response=await fetch('/api/measurement-types',{cache:'no-store'});
    if(!response.ok)throw Error('No se pudieron cargar los tipos de medición');
    setTypes((await response.json()).types||[]);
  },[]);
  const load=useCallback(async()=>{
    const response=await fetch(base,{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error);
    const latest:Run|null=data.runs[0]||null;setRun(latest);setAcknowledged([]);setIdentityReason('');setReviewed(false);
    if(latest){setKindChoice(latest.kind);setConsultation(latest.kind==='consultation'?latest.draft as ConsultationDraft:null);
      setExamination(latest.kind==='examination'?latest.draft as ExaminationDraft:null)}
  },[base]);
  useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false));loadTypes().catch(e=>setError(e.message))},[load,loadTypes]);
  useEffect(()=>{
    if(!examination){setTypeIds([]);return}
    setTypeIds(examination.measurements.map(m=>{
      const kind=m.numericValue!==null?'number':'text';
      const matches=types.filter(t=>t.name.toLocaleLowerCase('es')===m.typeName.toLocaleLowerCase('es')&&t.valueKind===kind);
      return matches.length===1?matches[0].id:null;
    }));
  },[run?.id,types]);
  async function csrf(){const response=await fetch('/api/auth/csrf',{cache:'no-store'});if(!response.ok)throw Error('No se pudo verificar la solicitud');return (await response.json()).token}
  async function analyze(){if(draft&&run?.status==='review'&&!window.confirm('Una nueva lectura reemplazará las correcciones de esta pantalla. ¿Continuar?'))return;setBusy(true);setError('');try{
    const response=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':await csrf()},body:JSON.stringify({kind:kindChoice})});
    const data=await response.json();if(!response.ok)throw Error(data.error);await load();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo analizar')}finally{setBusy(false)}}
  async function confirm(){if(!run)return;setBusy(true);setError('');try{
    const identity={identityAcknowledgements:acknowledged,identityReason};
    const body=run.kind==='examination'?{draft:examination,measurementTypeIds:typeIds,...identity}:{draft:consultation,...identity};
    const response=await fetch(`/api/patients/${patientId}/extractions/${run.id}/confirm`,{
      method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':await csrf()},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok)throw Error(data.error);
    window.location.href=run.kind==='examination'?`/patients/${patientId}/exams/${data.examination.id}`:`/patients/${patientId}/consultations/${data.consultation.id}`;
  }catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar')}finally{setBusy(false)}}
  function setConsultationField(key:keyof ConsultationDraft,value:string){setConsultation(current=>current?{...current,[key]:value||null}:current)}
  function setExaminationField(key:keyof ExaminationDraft,value:string){setExamination(current=>current?{...current,[key]:value||null}:current)}
  function setMeasurement(index:number,key:keyof Measurement,value:string){
    if(!examination)return;const measurements=[...examination.measurements];
    measurements[index]={...measurements[index],[key]:key==='typeName'||key==='originalValue'?value:value||null};
    if(key==='numericValue')setTypeIds(current=>current.map((id,i)=>i===index?null:id));
    setExamination({...examination,measurements});
  }
  const issues=run?.identityIssues||[];
  const identityReady=issues.every(issue=>acknowledged.includes(issue.field))&&(!issues.length||identityReason.trim().length>=10);
  const draft=run?.kind==='examination'?examination:consultation;
  return <div className="v-review-layout"><section className="v-panel"><h2>Documento original</h2>
      <p className="v-muted">Compara cada campo con el archivo antes de confirmar.</p>
      <a className="v-button v-secondary" href={`/api/patients/${patientId}/documents/${documentId}`} target="_blank" rel="noopener noreferrer">Abrir original</a>
    </section><section className="v-panel"><div className="v-section-head"><h2>Revisar y corregir datos</h2></div>
      <div className="v-toolbar"><label>Tipo de lectura<select value={kindChoice} onChange={event=>setKindChoice(event.target.value as 'consultation'|'examination')}>
        <option value="consultation">Consulta</option><option value="examination">Examen</option></select></label>
        <button className="v-button" disabled={loading||busy||run?.status==='running'} onClick={analyze}>{busy?'Procesando…':run?'Volver a extraer del original':'Iniciar lectura con IA'}</button></div>
      {loading&&<p className="v-muted" role="status">Cargando revisión…</p>}{error&&<p className="error" role="alert">{error}</p>}
      {run?.status==='running'&&<p className="v-muted">La lectura está en curso. Vuelve a cargar si tarda demasiado.</p>}
      {run?.status==='failed'&&<p className="v-muted">La lectura falló. El original sigue disponible.</p>}
      {run?.status==='confirmed'&&<p className="success">Esta extracción ya fue confirmada. <a className="v-text-link" href={`/patients/${patientId}/${run.kind==='examination'?'exams':'consultations'}/${run.examinationId||run.consultationId}`}>Ver registro →</a></p>}
      
      {draft&&run?.status!=='confirmed'&&<><p className="v-note">Revisa y corrige los campos. La fecha y los datos ausentes pueden quedar vacíos.</p>
        <div className="v-note"><strong>Identidad leída del original</strong><p>{run?.originalDraft?.patientName||draft.patientName||'Nombre no detectado'}</p>{(run?.originalDraft?.patientBirthDate||draft.patientBirthDate)&&<p>Nacimiento: {run?.originalDraft?.patientBirthDate||draft.patientBirthDate}</p>}</div>
        {issues.length>0&&<div className="v-warning" role="region" aria-label="Revisión de identidad"><h3>Verifica que este documento pertenece al paciente</h3>{issues.map(issue=><div key={issue.field}><p>{issue.message}</p><p><strong>Documento:</strong> {issue.documentValue} · <strong>Perfil:</strong> {issue.patientValue||'Sin dato comparable'}</p><label className="v-check"><input type="checkbox" checked={acknowledged.includes(issue.field)} onChange={e=>setAcknowledged(current=>e.target.checked?[...current,issue.field]:current.filter(f=>f!==issue.field))}/>He verificado {issue.field==='name'?'el nombre':issue.field==='birthDate'?'la fecha de nacimiento':'el identificador'} y confirmo que pertenece al paciente seleccionado.</label></div>)}<label className="v-search">Motivo de la confirmación<input value={identityReason} onChange={e=>setIdentityReason(e.target.value)} minLength={10} maxLength={1000} placeholder="Explica la diferencia y cómo verificaste la identidad"/></label></div>}
        <form onSubmit={event=>{event.preventDefault();void confirm()}}><div className="v-form">
          <label>Nombre del paciente leído (corregible)<input value={draft.patientName||''} maxLength={200} onChange={e=>run?.kind==='examination'?setExaminationField('patientName',e.target.value):setConsultationField('patientName',e.target.value)}/></label>
          <label>Fecha de nacimiento leída<input type="date" value={draft.patientBirthDate||''} onInput={e=>run?.kind==='examination'?setExaminationField('patientBirthDate',e.currentTarget.value):setConsultationField('patientBirthDate',e.currentTarget.value)} onChange={e=>run?.kind==='examination'?setExaminationField('patientBirthDate',e.target.value):setConsultationField('patientBirthDate',e.target.value)}/></label>
          <label>Identificador leído<input value={draft.patientIdentifier||''} maxLength={120} onChange={e=>run?.kind==='examination'?setExaminationField('patientIdentifier',e.target.value):setConsultationField('patientIdentifier',e.target.value)}/></label>
          <ClinicalFields fields={run?.kind==='examination'?sharedExaminationFields:sharedConsultationFields} values={draft} onChange={(key,value)=>run?.kind==='examination'?setExaminationField(key as keyof ExaminationDraft,value):setConsultationField(key as keyof ConsultationDraft,value)}/>
        </div>
        {run?.kind==='examination'&&examination&&<section><h3>Mediciones propuestas</h3>
          <p className="v-muted">Selecciona un tipo compatible para incorporarla como medición. Si no seleccionas ninguno, quedará como hallazgo narrativo.</p>
          <div className="v-toolbar"><a className="v-button v-secondary" href="/catalogs" target="_blank" rel="noopener noreferrer">Crear tipo en catálogo ↗</a>
            <button type="button" className="v-button v-secondary" onClick={()=>loadTypes().catch(e=>setError(e.message))}>Actualizar tipos</button></div>
          {examination.measurements.map((m,index)=><div className="v-note" key={index}><div className="v-form">
            <label>Tipo descrito<input value={m.typeName} onChange={event=>setMeasurement(index,'typeName',event.target.value)}/></label>
            <label>Valor original<input value={m.originalValue} onChange={event=>setMeasurement(index,'originalValue',event.target.value)}/></label>
            <label>Valor numérico, si consta<input value={m.numericValue||''} onChange={event=>setMeasurement(index,'numericValue',event.target.value)}/></label>
            <label>Unidad<input value={m.unit||''} onChange={event=>setMeasurement(index,'unit',event.target.value)}/></label>
            <label>Rango de referencia<input value={m.referenceRange||''} onChange={event=>setMeasurement(index,'referenceRange',event.target.value)}/></label>
            <label>Tipo del catálogo<select value={typeIds[index]||''} onChange={event=>setTypeIds(typeIds.map((value,i)=>i===index?event.target.value||null:value))}>
              <option value="">Solo hallazgo narrativo</option>{types.filter(t=>t.valueKind===(m.numericValue!==null?'number':'text')).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
            </select></label></div>
            <button type="button" className="v-link-button v-danger" onClick={()=>{setExamination({...examination,measurements:examination.measurements.filter((_,i)=>i!==index)});setTypeIds(current=>current.filter((_,i)=>i!==index))}}>Descartar esta propuesta</button>
          </div>)}
        </section>}
        <details><summary>Evidencia del documento</summary>{draft.evidence.length?draft.evidence.map((e,index)=><blockquote className="v-evidence" key={index}>
          <strong>{e.field}{e.page?' · pág. '+e.page:''}</strong><p>{e.quote}</p></blockquote>):<p className="v-muted">No se extrajeron citas verificables.</p>}</details>
        <label className="v-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>He comparado los datos con el original y revisado las correcciones.</label>
        <button className="v-button" type="submit" disabled={busy||!identityReady||!reviewed||run?.status!=='review'||(run.kind==='examination'&&!examination?.name?.trim())}>
          Guardar {run?.kind==='examination'?'examen revisado':'consulta revisada'}</button></form>
      </>}
    </section></div>;
}

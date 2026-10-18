'use client';
import {CatalogPicker} from '../../../../components/catalog-picker';
import {ArchiveRecord} from '../../../../components/archive-record';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Values={consultationId?:string|null;doctorId?:string|null;centerId?:string|null;specialtyId?:string|null;name:string;eventDate:string|null;indication:string|null;findings:string|null;conclusion:string|null;status:string;version:number};
export function ExaminationEditor({patientId,examinationId,values,consultations=[]}:{patientId:string;examinationId:string;values:Values;consultations?:{id:string;label:string}[]}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const router=useRouter();
  async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{
    const form=new FormData(event.currentTarget);
    const csrfResponse=await fetch('/api/auth/csrf',{cache:'no-store'});if(!csrfResponse.ok)throw Error('No se pudo verificar la solicitud');
    const token=(await csrfResponse.json()).token;
    const nullable=(name:string)=>String(form.get(name)||'').trim()||null;
    const response=await fetch(`/api/patients/${patientId}/examinations/${examinationId}`,{
      method:'PATCH',headers:{'Content-Type':'application/json','x-csrf-token':token},
      body:JSON.stringify({version:values.version,name:String(form.get('name')||''),eventDate:nullable('eventDate'),
        consultationId:nullable('consultationId'),doctorId:nullable('doctorId'),centerId:nullable('centerId'),specialtyId:nullable('specialtyId'),indication:nullable('indication'),findings:nullable('findings'),conclusion:nullable('conclusion'),
        status:String(form.get('status')||'draft'),changeReason:String(form.get('changeReason')||'')})
    });
    const result=await response.json();if(!response.ok)throw Error(result.error);
    setOpen(false);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar')}finally{setBusy(false)}}
  return <section className="v-panel"><ArchiveRecord endpoint={`/api/patients/${patientId}/examinations/${examinationId}`} payload={{...values}} returnTo={`/patients/${patientId}/exams`}/><button className="v-button v-secondary" type="button" onClick={()=>setOpen(!open)}>
    {open?'Cerrar edición':'Corregir examen'}</button>{error&&<p className="error" role="alert">{error}</p>}
    {open&&<form className="v-form" onSubmit={save}><label>Nombre<input name="name" defaultValue={values.name} required maxLength={200}/></label>
      <label>Consulta relacionada (opcional)<select name="consultationId" defaultValue={values.consultationId||''}><option value="">Sin asociar</option>{consultations.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Fecha<input type="date" name="eventDate" defaultValue={values.eventDate||''}/></label>
      <CatalogPicker kind="doctors" name="doctorId" label="Doctor" defaultValue={values.doctorId||''}/><CatalogPicker kind="centers" name="centerId" label="Centro médico" defaultValue={values.centerId||''}/><CatalogPicker kind="specialties" name="specialtyId" label="Especialidad" defaultValue={values.specialtyId||''}/><label>Indicación<textarea name="indication" defaultValue={values.indication||''}/></label>
      <label>Hallazgos<textarea name="findings" defaultValue={values.findings||''}/></label>
      <label>Conclusión<textarea name="conclusion" defaultValue={values.conclusion||''}/></label>
      <label>Estado<select name="status" defaultValue={values.status}><option value="draft">Borrador</option>
        <option value="published">Publicado</option></select></label>
      <label>Motivo de la corrección<input name="changeReason" required maxLength={500}/></label>
      <button className="v-button" disabled={busy}>Guardar corrección</button></form>}
  </section>;
}

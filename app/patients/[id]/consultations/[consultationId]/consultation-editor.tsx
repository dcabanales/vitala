'use client';
import {ClinicalFields,consultationFields} from '../../../../components/clinical-fields';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function ConsultationEditor({patientId,consultationId,version,status,summary,conclusion,values}:{patientId:string;consultationId:string;version:number;status:string;summary:string;conclusion:string;values:Record<string,unknown>}){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),router=useRouter();
  async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const fd=new FormData(e.currentTarget);try{
    const token=(await (await fetch('/api/auth/csrf',{cache:'no-store'})).json()).token;
    const r=await fetch(`/api/patients/${patientId}/consultations/${consultationId}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-csrf-token':token},body:JSON.stringify({...Object.fromEntries(consultationFields.filter(f=>!['doctorName','centerName','specialtyName'].includes(f.name)).map(f=>[f.name,String(fd.get(f.name)||'')||null])),version,status:String(fd.get('status')||'draft'),changeReason:String(fd.get('changeReason')||'')})}),j=await r.json();if(!r.ok)throw Error(j.error);
    setOpen(false);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar')}finally{setBusy(false)}}
  return <section className="v-panel"><button className="v-button v-secondary" onClick={()=>setOpen(!open)}>{open?'Cerrar edición':'Editar consulta'}</button>{error&&<p className="error" role="alert">{error}</p>}{open&&<form className="v-form" onSubmit={save}><ClinicalFields fields={consultationFields.filter(f=>!['doctorName','centerName','specialtyName'].includes(f.name))} values={{...values,summary,conclusion}}/><label>Estado<select name="status" defaultValue={status}><option value="draft">Borrador</option><option value="published">Publicada</option></select></label><label>Motivo del cambio<input name="changeReason" required maxLength={500}/></label><button className="v-button" disabled={busy}>Guardar cambios</button></form>}</section>
}

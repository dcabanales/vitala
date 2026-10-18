'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {RecordEditor,type EditField} from '../../../../components/record-editor';
export type LabResult={id:string;version:number;nameAsDocumented:string;originalValue:string;numericValue:string|null;textValue:string|null;codeValue:string|null;valueKind:string;components:Record<string,string>|null;comparator:string|null;unit:string|null;referenceRange:string|null;status:string};
export function ResultEditor({patientId,results}:{patientId:string;results:LabResult[]}){
 const [selected,setSelected]=useState<string|null>(null),router=useRouter();
 const m=results.find(x=>x.id===selected);
 const fields:EditField[]=m?[{name:'nameAsDocumented',label:'Nombre del análisis',required:true},{name:'originalValue',label:'Resultado tal como aparece en el informe',required:true},
 ...(['number','interval'].includes(m.valueKind)?[{name:'numericValue',label:'Valor numérico',required:true}]:[]),
 ...(m.valueKind==='text'?[{name:'textValue',label:'Resultado de texto',required:true}]:[]),...(m.valueKind==='code'?[{name:'codeValue',label:'Código',required:true}]:[]),
 ...(m.valueKind==='components'?Object.keys(m.components||{}).map(k=>({name:'component:'+k,label:k,required:true})):[]),
 ...(m.valueKind==='interval'?[{name:'comparator',label:'Comparador',options:[['<','Menor que'],['<=','Menor o igual'],['=','Igual'],['>=','Mayor o igual'],['>','Mayor que']] as [string,string][]}]:[]),
 {name:'unit',label:'Unidad'},{name:'referenceRange',label:'Referencia del laboratorio'}]:[];
 return <section id="corregir-resultados" className="v-panel v-result-editor"><h2>Corregir resultados individuales</h2><p className="v-section-description">Selecciona un análisis para corregir su nombre, valor, unidad o referencia. Cada cambio queda registrado.</p><label>Análisis<select value={selected||''} onChange={e=>setSelected(e.target.value||null)}><option value="">Selecciona un resultado</option>{results.map(r=><option key={r.id} value={r.id}>{r.nameAsDocumented} · {r.originalValue}{r.status==='draft'?' · Borrador':''}</option>)}</select></label>{m&&<RecordEditor key={m.id+':'+m.version} standalone endpoint={`/api/patients/${patientId}/measurements`} record={m} fields={fields} onCancel={()=>setSelected(null)} onSaved={()=>{setSelected(null);router.refresh()}}/>}</section>;
}
export function GenerateInterpretation({patientId,examinationId,stale=false}:{patientId:string;examinationId:string;stale?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),router=useRouter();
 async function generate(){setBusy(true);setError('');try{const csrf=await(await fetch('/api/auth/csrf',{cache:'no-store'})).json();const r=await fetch(`/api/patients/${patientId}/examinations/${examinationId}/interpretation`,{method:'POST',headers:{'x-csrf-token':csrf.token}});const j=await r.json();if(!r.ok)throw Error(j.error);router.refresh()}catch(e){setError(e instanceof Error?e.message:'No se pudo generar la explicación')}finally{setBusy(false)}}
 return <div>{stale&&<p>Los resultados cambiaron. Genera una nueva explicación para usar los valores actuales.</p>}<button type="button" className="v-button v-secondary" disabled={busy} onClick={generate}>{busy?'Preparando explicación…':stale?'Actualizar explicación de IA':'Generar explicación de IA'}</button>{error&&<p className="error" role="alert">{error}</p>}</div>;
}

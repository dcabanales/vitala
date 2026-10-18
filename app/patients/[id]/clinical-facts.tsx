'use client';
import {StatusLabel,RecordLabel} from '../../components/status-label';
import {ArchiveRecord} from '../../components/archive-record';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {conditionStateLabel,clinicalDate} from '../../lib/labels';
type Kind='conditions'|'allergies'|'history';
type Fact={id:string;version:number;name?:string;conditionId?:string;state?:string;certainty?:string;note?:string|null;substance?:string;kind?:string;reaction?:string|null;severity?:string|null;title?:string;detail?:string|null;familyRelation?:string|null;documentedDate?:string|null;sourceNote?:string|null;status:string};
type Catalog={id:string;name:string};
const sections: {kind:Kind;title:string;action:string;singular:string}[]=[{kind:'conditions',title:'Condiciones médicas',action:'Añadir condición',singular:'condición'},{kind:'allergies',title:'Alergias e intolerancias',action:'Añadir alergia',singular:'alergia'},{kind:'history',title:'Antecedentes',action:'Añadir antecedente',singular:'antecedente'}];
async function json(url:string,options?:RequestInit){const r=await fetch(url,{cache:'no-store',...options});const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudieron cargar los datos');return data}
export function ClinicalFacts({patientId,role}:{patientId:string;role:'admin'|'patient'}){
 const [items,setItems]=useState<Record<Kind,Fact[]>>({conditions:[],allergies:[],history:[]}),[catalog,setCatalog]=useState<Catalog[]>([]);
 const [editor,setEditor]=useState<{kind:Kind;item?:Fact}|null>(null),[newCondition,setNewCondition]=useState(false),[conditionId,setConditionId]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const router=useRouter();
 const load=useCallback(async()=>{setLoading(true);try{
  const [c,a,h]=await Promise.all(['conditions','allergies','history'].map(k=>json(`/api/patients/${patientId}/${k}`)));
  setItems({conditions:c.conditions,allergies:a.allergies,history:h.history});
  if(role==='admin')setCatalog((await json('/api/catalogs/conditions')).items);
 }catch(e){setError(e instanceof Error?e.message:'No se pudo cargar la información')}finally{setLoading(false)}},[patientId,role]);
 useEffect(()=>{void load()},[load]);
 function open(kind:Kind,item?:Fact){setEditor({kind,item});setConditionId(item?.conditionId||'');setNewCondition(false);setError('');setNotice('')}
 async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!editor)return;setBusy(true);setError('');const fd=new FormData(event.currentTarget),text=(key:string)=>String(fd.get(key)||'').trim()||null;
 try{
  const token=(await json('/api/auth/csrf')).token,headers={'Content-Type':'application/json','x-csrf-token':token};
  let selected=conditionId;
  if(editor.kind==='conditions'&&newCondition){const created=await json('/api/catalogs/conditions',{method:'POST',headers,body:JSON.stringify({name:text('newConditionName')})});selected=created.item.id;setConditionId(selected);setCatalog(c=>[...c,created.item]);setNewCondition(false)}
  const payload:Record<string,unknown>={documentedDate:text('documentedDate'),status:text('status')||'published'};
  if(editor.kind==='conditions')Object.assign(payload,{conditionId:selected,state:text('state'),certainty:text('certainty'),note:text('note'),sourceNote:text('sourceNote')});
  if(editor.kind==='allergies')Object.assign(payload,{substance:text('substance'),kind:text('kind'),reaction:text('reaction'),severity:text('severity'),state:text('state'),sourceNote:text('sourceNote')});
  if(editor.kind==='history')Object.assign(payload,{kind:text('kind'),title:text('title'),detail:text('detail'),familyRelation:text('familyRelation')});
  if(editor.item)Object.assign(payload,{id:editor.item.id,version:editor.item.version,changeReason:text('changeReason')});
  await json(`/api/patients/${patientId}/${editor.kind}`,{method:editor.item?'PATCH':'POST',headers,body:JSON.stringify(payload)});
  setEditor(null);setNotice('Registro guardado.');await load();router.refresh();
 }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar')}finally{setBusy(false)}}
 return <>{error&&<div className="error" role="alert">{error} {!editor&&<button className="v-link-button" onClick={()=>{setError('');void load()}}>Reintentar carga</button>}</div>}{notice&&<p role="status" className="success">{notice}</p>}
 {sections.map(section=>{const active=editor?.kind===section.kind,p=active?editor?.item:undefined;
 return <section className="v-panel" key={section.kind} id={section.kind==='history'?'antecedentes':section.kind}><div className="v-section-head"><h2>{section.title}</h2>{role==='admin'&&!active&&<button type="button" className="v-button v-secondary" disabled={loading} onClick={()=>open(section.kind)}>{section.action}</button>}</div>
 {active&&<form className="v-form v-editing" onSubmit={save} key={p?.id||'new'} aria-label={(p?'Editar ':'Nueva ')+section.singular}>
 <h3 className="v-form-wide">{p?'Editar':'Registrar'} {section.singular}</h3>
 {section.kind==='conditions'&&<>
  <label>Condición del catálogo<select value={newCondition?'__new':conditionId} onChange={e=>{setNewCondition(e.target.value==='__new');setConditionId(e.target.value==='__new'?'':e.target.value)}} required><option value="">Selecciona una condición</option>{p?.conditionId&&!catalog.some(c=>c.id===p.conditionId)&&<option value={p.conditionId}>{p.name} (archivada)</option>}{catalog.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}<option value="__new">+ Crear una nueva condición</option></select></label>
  {!catalog.length&&!newCondition&&<p className="v-catalog-empty">El catálogo está vacío. Selecciona «Crear una nueva condición» para registrar la primera.</p>}
  {newCondition&&<label>Nombre de la nueva condición<input name="newConditionName" required maxLength={200} placeholder="Tal como está documentada"/></label>}
  <label>Certeza<select name="certainty" defaultValue={p?.certainty||'unknown'}><option value="unknown">No documentada</option><option value="confirmed">Confirmada en la fuente</option><option value="suspected">Sospecha documentada</option></select></label>
  <label>Observación del paciente<textarea name="note" defaultValue={p?.note||''} maxLength={4000}/></label>
 </>}
 {section.kind==='allergies'&&<><label>Sustancia<input name="substance" required maxLength={180} defaultValue={p?.substance||''}/></label><label>Tipo<select name="kind" defaultValue={p?.kind||'allergy'}><option value="allergy">Alergia</option><option value="intolerance">Intolerancia</option></select></label><label>Reacción<textarea name="reaction" maxLength={2000} defaultValue={p?.reaction||''}/></label><label>Gravedad documentada<input name="severity" maxLength={120} defaultValue={p?.severity||''}/></label></>}
 {section.kind!=='history'&&<><label>Estado<select name="state" defaultValue={p?.state||'unknown'}><option value="unknown">No documentado</option><option value="active">Activa</option><option value="resolved">Resuelta</option>{section.kind==='conditions'&&<option value="historical">Histórica</option>}</select></label><label>Fuente / referencia<input name="sourceNote" maxLength={500} defaultValue={p?.sourceNote||''}/></label></>}
 {section.kind==='history'&&<><label>Tipo<select name="kind" defaultValue={p?.kind||'personal'}><option value="personal">Antecedente personal</option><option value="family">Antecedente familiar</option><option value="surgery">Cirugía</option><option value="hospitalization">Hospitalización</option><option value="other">Otro</option></select></label><label>Título<input name="title" required maxLength={200} defaultValue={p?.title||''}/></label><label>Detalle<textarea name="detail" maxLength={4000} defaultValue={p?.detail||''}/></label><label>Parentesco, si corresponde<input name="familyRelation" maxLength={120} defaultValue={p?.familyRelation||''}/></label></>}
 <label>Fecha documentada<input name="documentedDate" type="date" defaultValue={p?.documentedDate||''}/></label><label>Visibilidad<select name="status" defaultValue={p?.status||'published'}><option value="published">Publicado en el expediente</option><option value="draft">Borrador privado</option></select></label>
 {p&&<label className="v-form-wide">Motivo de la corrección<input name="changeReason" required maxLength={500}/></label>}
 <div className="v-form-actions"><button className="v-button" disabled={busy}>{busy?'Guardando…':'Guardar '+section.singular}</button><button className="v-button v-secondary" type="button" disabled={busy} onClick={()=>setEditor(null)}>Cancelar</button></div>
 </form>}
 {loading?<p role="status" className="v-empty-inline">Cargando información…</p>:items[section.kind].length?items[section.kind].map(item=><article className="v-clinical-row" key={item.id}><div className="v-section-head"><strong>{item.name||item.substance||item.title}</strong>{role==='admin'&&<button className="v-link-button" onClick={()=>open(section.kind,item)} aria-label={'Editar '+(item.name||item.substance||item.title)}>Editar</button>}</div>
 {item.state&&<div className="v-labels"><StatusLabel tone={item.state==='active'?'info':'neutral'}>{conditionStateLabel(item.state)}</StatusLabel>{item.certainty&&<StatusLabel tone={item.certainty==='suspected'?'warning':'neutral'}>{item.certainty==='confirmed'?'Confirmada':item.certainty==='suspected'?'Sospecha':'Certeza no documentada'}</StatusLabel>}</div>}{item.status==='draft'&&<RecordLabel status="draft"/>}{item.reaction&&<p>Reacción: {item.reaction}</p>}{item.severity&&<p>Gravedad: {item.severity}</p>}{(item.note||item.detail)&&<p>{item.note||item.detail}</p>}<small>{clinicalDate(item.documentedDate)||'Fecha no documentada'}{item.sourceNote?' · '+item.sourceNote:''}</small>{role==='admin'&&<ArchiveRecord endpoint={`/api/patients/${patientId}/${section.kind}`} payload={{id:item.id,version:item.version}} onSaved={()=>{void load();router.refresh()}}/>}</article>):<p className="v-empty-inline">No hay {section.title.toLowerCase()} registrados.</p>}
 </section>})}</>;
}

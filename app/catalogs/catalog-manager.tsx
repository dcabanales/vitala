'use client';
import {useCallback,useEffect,useState} from 'react';

type Item={id:string;name:string;active:boolean;specialtyIds?:string[];centerIds?:string[];
  city?:string;country?:string;registration?:string;jurisdiction?:string;active_ingredient?:string;description?:string;source?:string;category?:string;valueKind?:string;defaultUnit?:string|null};
const kinds=[['specialties','Especialidades'],['doctors','Doctores'],['centers','Centros médicos'],
  ['conditions','Enfermedades'],['medications','Medicamentos'],['measurement-types','Tipos de medición']] as const;
const categoryLabels:Record<string,string>={vital:'Signo vital',laboratory:'Laboratorio',other:'Otro'};
const valueLabels:Record<string,string>={number:'Número',text:'Texto',code:'Código',interval:'Comparación',components:'Componentes'};

export function CatalogManager(){
  const [kind,setKind]=useState<string>('specialties'),[items,setItems]=useState<Item[]>([]);
  const [specialties,setSpecialties]=useState<Item[]>([]),[centers,setCenters]=useState<Item[]>([]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState<Item|null>(null),[notice,setNotice]=useState('');
  const [formVersion,setFormVersion]=useState(0);
  const measurementTypes=kind==='measurement-types';
  const endpoint=measurementTypes?'/api/measurement-types':'/api/catalogs/'+kind;
  const load=useCallback(async()=>{try{
    const r=await fetch(endpoint+'?all=1',{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error);
    setItems(measurementTypes?j.types:j.items);setError('');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo cargar')}},[endpoint,measurementTypes]);
  useEffect(()=>{void load();if(kind==='doctors')void Promise.all(['specialties','centers'].map(k=>fetch('/api/catalogs/'+k).then(r=>r.json())))
    .then(([s,c])=>{setSpecialties(s.items);setCenters(c.items)})},[kind,load]);
  async function mutate(payload:unknown,method:'POST'|'PATCH'){
    setBusy(true);setError('');try{
      const csrf=await fetch('/api/auth/csrf',{cache:'no-store'});if(!csrf.ok)throw Error('No se pudo verificar la solicitud');
      const token=(await csrf.json()).token;
      const r=await fetch(endpoint,{method,headers:{'Content-Type':'application/json','x-csrf-token':token},body:JSON.stringify(payload)}),j=await r.json();
      if(!r.ok)throw Error(j.error);await load();return true;
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar');return false}finally{setBusy(false)}
  }
  async function create(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,fd=new FormData(form);
    const payload=measurementTypes?{name:String(fd.get('name')||''),category:String(fd.get('category')||'other'),
      valueKind:String(fd.get('valueKind')||'number'),defaultUnit:String(fd.get('defaultUnit')||'')||null}:
      {name:String(fd.get('name')||''),specialtyIds:fd.getAll('specialtyIds'),centerIds:fd.getAll('centerIds'),city:String(fd.get('city')||''),country:String(fd.get('country')||''),registration:String(fd.get('registration')||''),jurisdiction:String(fd.get('jurisdiction')||''),activeIngredient:String(fd.get('activeIngredient')||''),description:String(fd.get('description')||''),source:String(fd.get('source')||'')};
    if(await mutate({...payload,...(editing?{id:editing.id}:{})},editing?'PATCH':'POST')){form.reset();setEditing(null);setFormVersion(v=>v+1);setNotice('Registro guardado.');}
  }
  return <><div className="v-tabs v-catalog-tabs">{kinds.map(([key,label])=><button type="button" className={kind===key?'v-selected':''}
    key={key} onClick={()=>{setItems([]);setEditing(null);setNotice('');setKind(key)}}>{label}</button>)}</div>
    {notice&&<p className="success" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
    <section className="v-panel" id="catalog-editor"><h2>{editing?'Editar':'Añadir'} {kinds.find(k=>k[0]===kind)?.[1].toLowerCase()}</h2>
      <form className="v-form" onSubmit={create} key={kind+(editing?.id||'new')+formVersion}><label className={kind==='doctors'?'v-form-wide':undefined}>Nombre<input name="name" defaultValue={editing?.name||''} required maxLength={measurementTypes?160:200}/></label>
        {kind==='centers'&&<label>Ciudad<input name="city" defaultValue={editing?.city||''} maxLength={160}/></label>}
        {measurementTypes&&<><label>Categoría<select name="category" defaultValue={editing?.category||'other'}><option value="vital">Signo vital</option>
          <option value="laboratory">Laboratorio</option><option value="other">Otro</option></select></label>
          <label>Tipo de valor<select name="valueKind" defaultValue={editing?.valueKind||'number'}><option value="number">Número</option><option value="text">Texto</option>
            <option value="code">Código</option><option value="interval">Comparación</option>
            <option value="components">Componentes</option></select></label>
          <label>Unidad por defecto<input name="defaultUnit" defaultValue={editing?.defaultUnit||''} maxLength={40} placeholder="Opcional"/></label></>}
        {kind==='centers'&&<label>País<input name="country" defaultValue={editing?.country||''} maxLength={100}/></label>}{kind==='doctors'&&<><label>Número de registro<input name="registration" defaultValue={editing?.registration||''} maxLength={100}/></label><label>Jurisdicción<input name="jurisdiction" defaultValue={editing?.jurisdiction||''} maxLength={100}/></label><div className="v-form-wide v-catalog-associations"><CatalogChoices label="Especialidades" name="specialtyIds" items={specialties} initial={editing?.specialtyIds||[]}/><CatalogChoices label="Centros médicos" name="centerIds" items={centers} initial={editing?.centerIds||[]}/></div></>}{kind==='medications'&&<><label>Principio activo<input name="activeIngredient" defaultValue={editing?.active_ingredient||''} maxLength={200}/></label><label>Fuente<input name="source" defaultValue={editing?.source||''} maxLength={500}/></label></>}{['medications','conditions'].includes(kind)&&<label className="v-form-wide">Descripción<textarea name="description" defaultValue={editing?.description||''} maxLength={3000}/></label>}<div className="v-form-actions"><button className="v-button" disabled={busy}>Guardar</button>{editing&&<button type="button" className="v-button v-secondary" onClick={()=>setEditing(null)}>Cancelar</button>}</div></form></section>
    <section className="v-panel"><h2>{kinds.find(k=>k[0]===kind)?.[1]}</h2><div className="v-list">
      {items.map(item=><div className="v-catalog-row" key={item.id}><strong>{item.name}</strong>
        {measurementTypes&&<span>{categoryLabels[item.category||'']||item.category} · {valueLabels[item.valueKind||'']||item.valueKind}
          {item.defaultUnit?' · '+item.defaultUnit:''}</span>}
        <a href="#catalog-editor" className="v-link-button" onClick={()=>{setEditing(item);setNotice('')}}>Editar</a><span>{item.active?'Activo':'Inactivo'}</span><button type="button" className="v-link-button" disabled={busy}
          onClick={()=>void mutate({id:item.id,active:!item.active},'PATCH')}>{item.active?'Desactivar':'Activar'}</button></div>)}
    </div>{!items.length&&<p className="v-muted">No hay registros.</p>}</section></>;
}

function CatalogChoices({label,name,items,initial}:{label:string;name:string;items:Item[];initial:string[]}){
 const [selected,setSelected]=useState(initial),[search,setSearch]=useState('');
 return <fieldset className="v-catalog-choices"><legend>{label}</legend><p>Selecciona una o varias opciones.</p><input aria-label={'Buscar en '+label.toLowerCase()} placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}/>{selected.map(id=><input key={id} type="hidden" name={name} value={id}/>)}<div className="v-choice-list">{items.filter(i=>i.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(i=><label key={i.id} className="v-choice"><input type="checkbox" checked={selected.includes(i.id)} onChange={e=>setSelected(current=>e.target.checked?[...current,i.id]:current.filter(id=>id!==i.id))}/><span>{i.name}</span></label>)}{!items.length&&<p>No hay opciones registradas.</p>}</div><small>{selected.length} seleccionadas</small></fieldset>;
}

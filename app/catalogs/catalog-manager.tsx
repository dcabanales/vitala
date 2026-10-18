'use client';
import {useCallback,useEffect,useState} from 'react';

type Item={id:string;name:string;active:boolean;specialtyIds?:string[];centerIds?:string[];
  category?:string;valueKind?:string;defaultUnit?:string|null};
const kinds=[['specialties','Especialidades'],['doctors','Doctores'],['centers','Centros médicos'],
  ['conditions','Enfermedades'],['medications','Medicamentos'],['measurement-types','Tipos de medición']] as const;
const categoryLabels:Record<string,string>={vital:'Signo vital',laboratory:'Laboratorio',other:'Otro'};
const valueLabels:Record<string,string>={number:'Número',text:'Texto',code:'Código',interval:'Comparación',components:'Componentes'};

export function CatalogManager(){
  const [kind,setKind]=useState<string>('specialties'),[items,setItems]=useState<Item[]>([]);
  const [specialties,setSpecialties]=useState<Item[]>([]),[centers,setCenters]=useState<Item[]>([]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
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
      {name:String(fd.get('name')||''),specialtyIds:fd.getAll('specialtyIds'),centerIds:fd.getAll('centerIds'),city:String(fd.get('city')||'')};
    if(await mutate(payload,'POST'))form.reset();
  }
  return <><div className="v-tabs v-catalog-tabs">{kinds.map(([key,label])=><button type="button" className={kind===key?'v-selected':''}
    key={key} onClick={()=>{setItems([]);setKind(key)}}>{label}</button>)}</div>
    {error&&<p className="error" role="alert">{error}</p>}
    <section className="v-panel"><h2>Añadir {kinds.find(k=>k[0]===kind)?.[1].toLowerCase()}</h2>
      <form className="v-form" onSubmit={create}><label>Nombre<input name="name" required maxLength={measurementTypes?160:200}/></label>
        {kind==='centers'&&<label>Ciudad<input name="city" maxLength={160}/></label>}
        {kind==='doctors'&&<><label>Especialidades<select name="specialtyIds" multiple size={Math.min(5,Math.max(2,specialties.length))}>
          {specialties.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Centros<select name="centerIds" multiple size={Math.min(5,Math.max(2,centers.length))}>
            {centers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></>}
        {measurementTypes&&<><label>Categoría<select name="category"><option value="vital">Signo vital</option>
          <option value="laboratory">Laboratorio</option><option value="other">Otro</option></select></label>
          <label>Tipo de valor<select name="valueKind"><option value="number">Número</option><option value="text">Texto</option>
            <option value="code">Código</option><option value="interval">Comparación</option>
            <option value="components">Componentes</option></select></label>
          <label>Unidad por defecto<input name="defaultUnit" maxLength={40} placeholder="Opcional"/></label></>}
        <button className="v-button" disabled={busy}>Guardar</button></form></section>
    <section className="v-panel"><h2>{kinds.find(k=>k[0]===kind)?.[1]}</h2><div className="v-list">
      {items.map(item=><div className="v-catalog-row" key={item.id}><strong>{item.name}</strong>
        {measurementTypes&&<span>{categoryLabels[item.category||'']||item.category} · {valueLabels[item.valueKind||'']||item.valueKind}
          {item.defaultUnit?' · '+item.defaultUnit:''}</span>}
        <span>{item.active?'Activo':'Inactivo'}</span><button type="button" className="v-link-button" disabled={busy}
          onClick={()=>void mutate({id:item.id,active:!item.active},'PATCH')}>{item.active?'Desactivar':'Activar'}</button></div>)}
    </div>{!items.length&&<p className="v-muted">No hay registros.</p>}</section></>;
}

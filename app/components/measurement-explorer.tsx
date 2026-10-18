'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {measurementGroups,trendPoints,type MeasurementRecord} from '../lib/measurement-series';
import {Icon} from './health-icon';
import {friendlyDate} from '../lib/labels';
export function MeasurementExplorer({records,patientId,compact=false}:{records:MeasurementRecord[];patientId:string;compact?:boolean}){
 const groups=useMemo(()=>measurementGroups(records),[records]),[filter,setFilter]=useState('');
 const visible=groups.filter(g=>g.name.toLocaleLowerCase('es').includes(filter.toLocaleLowerCase('es')));
 return <div className="v-measurements">{!compact&&groups.length>3&&<label className="v-search">Buscar medición<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Por ejemplo, glucosa"/></label>}
 <div className="v-measure-grid">{(compact?visible.slice(0,3):visible).map(g=><MeasurementGroup key={g.key} group={g} patientId={patientId}/>)}</div>
 {!visible.length&&<p className="v-empty-inline">{filter?'No hay mediciones con ese nombre.':'Las mediciones que registres aparecerán aquí, junto a su fecha y documento de origen.'}</p>}
 {compact&&groups.length>3&&<Link className="v-text-link" href={`/patients/${patientId}/exams#mediciones`}>Explorar todas las mediciones <Icon name="arrow" size={16}/></Link>}</div>
}
function MeasurementGroup({group,patientId}:{group:ReturnType<typeof measurementGroups>[number];patientId:string}){
 const [selected,setSelected]=useState<string|null>(null),[range,setRange]=useState('all');
 const points=useMemo(()=>trendPoints(group.records),[group.records]);
 const cutoff=range==='all'?null:new Date(Date.now()-Number(range)*86400000).toISOString().slice(0,10);
 const visible=points.filter(m=>!cutoff||m.documentedDate!>=cutoff),current=visible.find(m=>m.id===selected)||visible.at(-1);
 const latest=group.records[0],root='/patients/'+patientId;
 const canGraph=visible.length>1&&new Set(visible.map(m=>m.documentedDate)).size>1;
 const nums=visible.map(m=>Number(m.numericValue)),low=Math.min(...nums),high=Math.max(...nums),span=high-low||Math.abs(high)*.1||1;
 const min=low-span*.15,max=high+span*.15,first=Date.parse(visible[0]?.documentedDate||'2000-01-01'),last=Date.parse(visible.at(-1)?.documentedDate||'2000-01-02');
 const coords=visible.map(m=>({m,x:48+(Date.parse(m.documentedDate!)-first)/(last-first||1)*460,y:150-(Number(m.numericValue)-min)/(max-min)*120}));
 return <details className="v-measure-card"><summary><span className="v-measure-name"><Icon name="chart"/>{group.name}</span><span className="v-measure-value">{latest.originalValue}{group.unit&&!latest.originalValue.toLowerCase().endsWith(group.unit.toLowerCase())&&<small> {group.unit}</small>}</span><span className="v-measure-meta">{friendlyDate(latest.documentedDate)||'Fecha no registrada'}{latest.status==='draft'?' · Borrador':''}{group.sample?' · '+group.sample:''}</span><span className="v-expand-label"><span className="v-when-closed">Explorar resultados</span><span className="v-when-open">Cerrar evolución</span> <Icon name="arrow" size={15}/></span></summary>
 <div className="v-measure-expanded"><p className="v-form-note">Resultados registrados con la misma unidad y muestra. La evolución no interpreta su significado clínico.</p>
 {points.length>1&&<div className="v-segments" aria-label={'Periodo de '+group.name}>{[['all','Todo'],['365','Último año'],['90','3 meses']].map(([v,l])=><button type="button" key={v} aria-pressed={range===v} onClick={()=>{setRange(v);setSelected(null)}}>{l}</button>)}</div>}
 {canGraph?<><div className="v-chart-selection" aria-live="polite"><strong>{current?.originalValue}</strong><span>{friendlyDate(current?.documentedDate)}</span></div><svg className="v-trend" viewBox="0 0 540 190" role="img" aria-label={`Evolución de ${group.name}, ${group.unit}. Los valores exactos están en la lista inferior.`}><line x1="48" y1="150" x2="508" y2="150" stroke="var(--line)"/><line x1="48" y1="30" x2="508" y2="30" stroke="var(--line)" strokeDasharray="4 5"/><text x="4" y="34">{Number(max.toPrecision(3))}</text><text x="4" y="154">{Number(min.toPrecision(3))}</text><polyline points={coords.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--green)" strokeWidth="2.5"/>{coords.map(p=><circle key={p.m.id} cx={p.x} cy={p.y} r={current?.id===p.m.id?6:4} fill={current?.id===p.m.id?'var(--green)':'white'} stroke="var(--green)" strokeWidth="2"><title>{`${friendlyDate(p.m.documentedDate)}: ${p.m.originalValue}`}</title></circle>)}<text x="48" y="180">{friendlyDate(visible[0].documentedDate)}</text><text x="508" y="180" textAnchor="end">{friendlyDate(visible.at(-1)?.documentedDate)}</text></svg>
 <label className="v-search">Explorar un punto<select value={current?.id||''} onChange={e=>setSelected(e.target.value)}>{visible.map(m=><option value={m.id} key={m.id}>{friendlyDate(m.documentedDate)} · {m.originalValue}</option>)}</select></label></>:<p className="v-empty-inline">{cutoff?'No hay suficientes valores comparables en este periodo.':'La gráfica aparecerá con al menos dos valores numéricos publicados, con unidad y fechas distintas.'}</p>}
 <div className="v-measure-history">{group.records.map(m=><article key={m.id}><div className="v-section-head"><strong>{m.originalValue}</strong><time>{friendlyDate(m.documentedDate)||'Sin fecha'}{m.status==='draft'?' · Borrador':''}</time></div><p>Unidad: {m.unit||'No registrada'} · Referencia del informe: {m.referenceRange||'No registrada'}</p>{m.contextNote&&<p>{m.contextNote}</p>}<div className="v-source-links">{m.examinationId&&<Link href={`${root}/exams/${m.examinationId}`}>Ver examen <Icon name="arrow" size={14}/></Link>}{m.consultationId&&<Link href={`${root}/consultations/${m.consultationId}`}>Ver consulta <Icon name="arrow" size={14}/></Link>}{m.documentId&&<a href={`/api/patients/${patientId}/documents/${m.documentId}`} target="_blank" rel="noopener noreferrer">Documento original ↗</a>}</div></article>)}</div></div></details>
}

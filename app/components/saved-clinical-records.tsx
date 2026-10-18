import type {SavedClinicalItem} from '../lib/saved-clinical-items';
import {recordLabels} from '../lib/consultation-records';
export function SavedClinicalRecords({items,title='Datos incorporados al expediente'}:{items:SavedClinicalItem[];title?:string}){
 if(!items.length)return null;
 return <section className="v-health-section v-saved-records"><h2>{title} ({items.length})</h2><p className="v-section-description">Estos datos ya están guardados. Puedes consultarlos aquí o abrir su sección; no necesitas volver a leer el archivo.</p><div className="v-result-grid">{items.map(item=><article className="v-result-item" key={item.kind+item.id}><span className="v-category">{recordLabels[item.kind]||item.kind}{item.status==='void'?' · Retirado':item.status==='draft'?' · Borrador':''}</span><h3>{item.name}</h3>{item.value&&<strong>{item.value}</strong>}{item.detail&&<p className="v-prose">{item.detail}</p>}{item.kind==='measurement'&&<><p>Unidad: {item.unit||'No registrada'}</p><p className="v-reference">Referencia del informe: {item.reference||'No registrada'}</p></>}{item.status!=='void'&&<a className="v-text-link" href={item.href}>Ver en su sección →</a>}</article>)}</div></section>
}

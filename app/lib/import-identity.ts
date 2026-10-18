import {createHash} from 'node:crypto';
import type {ClinicalRecord} from './consultation-records';
export const normalizeImported=(value:unknown)=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
export function measurementIdentity(m:{name?:string;typeName?:string;originalValue?:string|null;numericValue?:string|null;unit?:string|null;referenceRange?:string|null}){
 return JSON.stringify([m.name||m.typeName,m.originalValue,m.numericValue,m.unit,m.referenceRange].map(normalizeImported));
}
export function clinicalIdentity(r:ClinicalRecord){
 const common=[r.kind,normalizeImported(r.name),r.phase];
 const fields=r.kind==='measurement'?[measurementIdentity(r)]:r.kind==='medication'?[r.dose,r.frequency,r.route,r.detail]:[r.detail,r.certainty];
 return JSON.stringify([...common,...fields.map(normalizeImported)]);
}
export function clinicalImportKey(r:ClinicalRecord){return 'v2:'+createHash('sha256').update(clinicalIdentity(r)).digest('hex')}

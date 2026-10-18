export type MeasurementRecord={id:string;typeId?:string;typeName:string;documentedDate:string|null;valueKind:string;numericValue:string|null;originalValue:string;unit:string|null;referenceRange:string|null;sample?:string|null;contextNote?:string|null;examinationId:string|null;consultationId?:string|null;documentId?:string|null;status:string};
export function measurementGroups(records:MeasurementRecord[]){
 const groups=new Map<string,{key:string;name:string;unit:string|null;sample:string|null;records:MeasurementRecord[]}>();
 for(const m of records){const key=JSON.stringify([m.typeId||null,m.typeName.trim().toLocaleLowerCase('es'),m.unit?.trim()||null,m.sample?.trim()||null]);let g=groups.get(key);if(!g){g={key,name:m.typeName,unit:m.unit,sample:m.sample||null,records:[]};groups.set(key,g)}g.records.push(m)}
 return [...groups.values()].map(g=>({...g,records:g.records.sort((a,b)=>(b.documentedDate||'').localeCompare(a.documentedDate||''))}));
}
export function trendPoints(records:MeasurementRecord[]){return records.filter(m=>m.status==='published'&&m.valueKind==='number'&&m.unit?.trim()&&m.numericValue!==null&&m.numericValue.trim()!==''&&Number.isFinite(Number(m.numericValue))&&m.documentedDate&&/^\d{4}-\d{2}-\d{2}$/.test(m.documentedDate)&&!Number.isNaN(Date.parse(m.documentedDate))).sort((a,b)=>a.documentedDate!.localeCompare(b.documentedDate!))}

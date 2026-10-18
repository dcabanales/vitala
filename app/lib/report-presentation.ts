export type Source={id:string;name:string;date:string|null;withdrawn:boolean};
export function reportText(value:string|null|undefined,full=false){
 const clean=(value||'').split('\n').filter(line=>!/^\s*(Fuente:|Cita:|Administrado durante la atención|Vigencia no documentada|Uso documentado en la fecha de la consulta)/i.test(line)).join('\n').replace(/los resultados numéricos constan en measurements\.?/gi,'Resultados en la tabla del estudio.').trim();
 if(full)return clean;
 const sentences=clean.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)||[clean];
 return sentences.slice(0,2).join('').trim();
}
export function reportKey(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
export function studyKey(row:{id:string;documents?:Source[];event_date?:string|null;documented_date?:string|null;examination_id?:string|null}){
 const date=(row.event_date||row.documented_date||'').slice(0,10);
 const docs=(row.documents||[]).filter(d=>!d.withdrawn).map(d=>d.id).sort();
 return date+'|'+(docs.length?docs.join(','):row.examination_id||row.id);
}
export function measurementWarning(name:string,value:string,unit:string|null){
 const n=Number(value.match(/[-+]?\d+(?:[.,]\d+)?/)?.[0]?.replace(',','.'));
 if(!Number.isFinite(n))return null;
 const label=reportKey(name),u=(unit||value).toLowerCase();
 if(label==='peso'&&/kg/.test(u)&&n>0&&n<1)return 'Valor o unidad de peso por verificar con el original';
 if(/^(talla|altura)$/.test(label)&&/cm/.test(u)&&n>0&&n<3)return 'Valor o unidad de talla por verificar con el original';
 return null;
}
export function resultCategory(name:string){
 const n=reportKey(name);
 if(/orina|urinari|nitrito|esterasa|mucina/.test(n))return 'Orina';
 if(/heces|coprolog|protozo|blastocyst|endolimax/.test(n))return 'Heces';
 if(/hemoglob|hematoc|eritro|globulosrojos|plaquet|neutro|linfo|mono|eosino|basof|leucoc|vcm|hcm|mchc|rdw|mpv/.test(n))return 'Hematología';
 if(/colesterol|triglicer|gluc|glic|urea|creatin|album|globulin|proteina|tgo|tgp|acido/.test(n))return 'Química';
 return 'Otros resultados';
}

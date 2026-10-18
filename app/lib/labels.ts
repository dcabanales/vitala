export function conditionStateLabel(value:string){
  return ({unknown:'Estado no documentado',active:'Activa',resolved:'Resuelta',historical:'Histórica'} as Record<string,string>)[value]||'Estado no documentado';
}
export function treatmentStateLabel(value:string){
  return ({unknown:'Vigencia no documentada',planned:'Planificado',active:'Activo',completed:'Completado',suspended:'Suspendido',paused:'Pausado'} as Record<string,string>)[value]||'Vigencia no documentada';
}
export function medicationStateLabel(value:string){
  return ({unknown:'Vigencia no documentada',planned:'Planificada',active:'Activa',completed:'Completada',suspended:'Suspendida',paused:'Pausada'} as Record<string,string>)[value]||'Vigencia no documentada';
}
export function clinicalDate(value:Date|string|null|undefined){
  if(!value)return '';
  if(value instanceof Date)return Number.isNaN(value.getTime())?'':value.toISOString().slice(0,10);
  const text=String(value),match=/^\d{4}-\d{2}-\d{2}/.exec(text);
  return match?match[0]:text;
}
export function ageYears(birthDate:string|null|undefined,asOf?:string){
  if(!birthDate||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))return null;
  const today=asOf||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(today)||birthDate>today)return null;
  const [year,month,day]=birthDate.split('-').map(Number),[currentYear,currentMonth,currentDay]=today.split('-').map(Number);
  return currentYear-year-(currentMonth<month||(currentMonth===month&&currentDay<day)?1:0);
}

export function friendlyDate(value:Date|string|null|undefined){
 const day=clinicalDate(value);if(!day)return '';
 const date=new Date(day.slice(0,10)+'T12:00:00Z');
 return Number.isNaN(date.getTime())?day:`${date.getUTCDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'][date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

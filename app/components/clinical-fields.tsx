'use client';
import {CatalogPicker} from './catalog-picker';
export type ClinicalField={name:string;label:string;type?:'date'|'text'|'textarea';maxLength?:number;required?:boolean};
export const consultationFields:ClinicalField[]=[
 {name:'eventDate',label:'Fecha de la consulta',type:'date'},
 {name:'doctorName',label:'Doctor',maxLength:160},{name:'centerName',label:'Centro médico',maxLength:160},{name:'specialtyName',label:'Especialidad',maxLength:120},
 {name:'reason',label:'Motivo',type:'textarea',maxLength:3000},{name:'symptoms',label:'Síntomas',type:'textarea',maxLength:5000},
 {name:'summary',label:'Resumen',type:'textarea',maxLength:8000},{name:'findings',label:'Hallazgos',type:'textarea',maxLength:8000},
 {name:'impression',label:'Impresión diagnóstica documentada',type:'textarea',maxLength:5000},{name:'conclusion',label:'Conclusión',type:'textarea',maxLength:8000},
 {name:'recommendations',label:'Recomendaciones documentadas',type:'textarea',maxLength:8000},{name:'followUp',label:'Seguimiento',type:'textarea',maxLength:3000}
];
export const examinationFields:ClinicalField[]=[{name:'name',label:'Nombre del examen',required:true,maxLength:200},
 {name:'eventDate',label:'Fecha',type:'date'},{name:'doctorName',label:'Doctor',maxLength:160},{name:'centerName',label:'Centro médico',maxLength:160},{name:'specialtyName',label:'Especialidad',maxLength:120},
 {name:'indication',label:'Indicación',type:'textarea',maxLength:4000},{name:'findings',label:'Hallazgos',type:'textarea',maxLength:8000},{name:'conclusion',label:'Conclusión',type:'textarea',maxLength:8000}];
export function ClinicalFields({fields,values,onChange}:{fields:ClinicalField[];values?:Record<string,unknown>;onChange?:(key:string,value:string)=>void}){
 return <>{fields.map(f=>{const catalog=({doctorName:'doctors',centerName:'centers',specialtyName:'specialties'} as Record<string,string>)[f.name];if(catalog)return <CatalogPicker key={f.name} kind={catalog} name={f.name} label={f.label} mode="name" defaultValue={String(values?.[f.name]??'')} value={onChange?String(values?.[f.name]??''):undefined} onChange={onChange?v=>onChange(f.name,v):undefined}/>;const props={name:f.name,required:f.required,maxLength:f.maxLength,...(onChange?{value:String(values?.[f.name]??''),onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>onChange(f.name,e.target.value)}:{defaultValue:String(values?.[f.name]??'')})};
 return <label key={f.name}>{f.label}{f.type==='textarea'?<textarea {...props}/>:<input {...props} type={f.type||'text'} onInput={onChange&&f.type==='date'?e=>onChange(f.name,e.currentTarget.value):undefined}/>}</label>})}</>;
}

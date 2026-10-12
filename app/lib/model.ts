import {z} from 'zod';
export const specialties=['Sin clasificar','Medicina general','Cardiología','Endocrinología','Neurología','Traumatología','Dermatología','Gastroenterología','Neumología','Ginecología','Urología','Oftalmología','Otorrinolaringología','Psiquiatría','Psicología','Reumatología','Oncología','Nefrología','Pediatría','Alergología','Fisioterapia','Nutrición','Otra'] as const;
export const recordTypes=['Medicación','Tratamiento','Enfermedad','Antecedente','Alergia','Medición','Consulta','Nota'] as const;
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s},'Fecha no válida');
const optionalDate=z.union([z.literal(''),date]);
export const treatmentSchema=z.object({status:z.enum(['Por confirmar','Activo','Pausado','Completado','Suspendido']),indication:z.string().max(300),dose:z.string().max(200),frequency:z.string().max(200),start:optionalDate,end:optionalDate,professional:z.string().max(150)}).refine(t=>!t.start||!t.end||t.end>=t.start,'La fecha final no puede ser anterior al inicio');
export const emptyTreatment={status:'Por confirmar' as const,indication:'',dose:'',frequency:'',start:'',end:'',professional:''};
export const entrySchema=z.object({id:z.string().min(1).max(100),type:z.enum(recordTypes),title:z.string().trim().min(1).max(200),detail:z.string().max(3000),date,source:z.string().max(300),specialty:z.enum(specialties).optional(),treatment:treatmentSchema.optional()});
export const profileSchema=z.object({name:z.string().trim().min(1).max(120),birth:optionalDate,sex:z.string().max(40),blood:z.string().max(20),phone:z.string().max(60),contact:z.string().max(150),summary:z.string().max(4000).optional()});
export const stateSchema=z.object({profile:profileSchema,entries:z.array(entrySchema).max(2000)});
export const patientSchema=stateSchema.extend({id:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)});
export const workspaceSchema=z.object({patients:z.array(patientSchema).min(1).max(200)}).refine(w=>new Set(w.patients.map(p=>p.id)).size===w.patients.length,'Paciente duplicado');
export type Entry=z.infer<typeof entrySchema>;export type Patient=z.infer<typeof stateSchema>;export type PatientRecord=z.infer<typeof patientSchema>;
export type Doc={id:string;name:string;type:string;size:number;date:string;specialty?:string};
export const blank:Patient={profile:{name:'',birth:'',sex:'',blood:'',phone:'',contact:'',summary:''},entries:[]};
export function healthSummary(patient:Patient){
 const conditions=patient.entries.filter(e=>e.type==='Enfermedad'||e.type==='Antecedente');
 const allergies=patient.entries.filter(e=>e.type==='Alergia');
 const active=patient.entries.filter(e=>e.type==='Tratamiento'&&e.treatment?.status==='Activo');
 return [conditions.length?`Enfermedades y antecedentes registrados: ${[...new Set(conditions.map(e=>e.title))].join('; ')}.`:'No hay enfermedades ni antecedentes registrados.',allergies.length?`Alergias registradas: ${[...new Set(allergies.map(e=>e.title))].join('; ')}.`:'No hay información registrada sobre alergias.',active.length?`Tratamientos marcados como activos: ${active.map(e=>e.title).join('; ')}.`:'No hay tratamientos marcados como activos.'].join(' ')
}
export const demo:Patient={profile:{name:'Elena Martínez',birth:'1988-05-15',sex:'Femenino',blood:'O+',phone:'+34 612 345 678',contact:'Daniel Martínez · +34 623 456 789',summary:'Seguimiento por endocrinología por hipotiroidismo. Alergia a penicilina documentada. Pendiente de incorporar la próxima analítica. Datos ficticios para explorar Vitala.'},entries:[
{id:'d1',type:'Medicación',title:'Levotiroxina · 50 µg',detail:'Una toma diaria en ayunas. Pauta registrada por su médico.',date:'2026-10-08',source:'Datos de ejemplo',specialty:'Endocrinología'},
{id:'d2',type:'Enfermedad',title:'Hipotiroidismo',detail:'Diagnóstico registrado en 2021. Seguimiento por endocrinología.',date:'2026-10-08',source:'Datos de ejemplo',specialty:'Endocrinología'},
{id:'d3',type:'Alergia',title:'Penicilina',detail:'Reacción registrada: urticaria.',date:'2026-10-08',source:'Datos de ejemplo',specialty:'Alergología'},
{id:'d4',type:'Medición',title:'Presión arterial',detail:'118/76 mmHg',date:'2026-10-10',source:'Datos de ejemplo',specialty:'Medicina general'},
{id:'d5',type:'Medición',title:'Frecuencia cardíaca',detail:'72 lpm',date:'2026-10-10',source:'Datos de ejemplo',specialty:'Medicina general'},
{id:'d6',type:'Medición',title:'Peso',detail:'64.5 kg',date:'2026-10-10',source:'Datos de ejemplo',specialty:'Medicina general'},
{id:'d7',type:'Consulta',title:'Consulta de endocrinología',detail:'Revisión de seguimiento. Se adjuntará la próxima analítica cuando esté disponible.',date:'2026-10-08',source:'Datos de ejemplo',specialty:'Endocrinología'},
{id:'d8',type:'Tratamiento',title:'Seguimiento del hipotiroidismo',detail:'Plan registrado por endocrinología. Ejemplo ficticio, no es una recomendación médica.',date:'2026-10-08',source:'Datos de ejemplo',specialty:'Endocrinología',treatment:{...emptyTreatment,status:'Activo',indication:'Hipotiroidismo',dose:'50 µg de levotiroxina',frequency:'Una toma diaria en ayunas',start:'2026-10-08',professional:'Dra. Isabel Romero'}}]};

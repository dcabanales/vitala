import {z} from 'zod';
export const recordKinds=['allergy','condition','history','treatment','medication','examination','measurement'] as const;
export const recordLabels:Record<string,string>={allergy:'Alergia o intolerancia',condition:'Condición documentada',history:'Antecedente',treatment:'Tratamiento',medication:'Medicación',examination:'Examen o prueba',measurement:'Medición o resultado'};
export const clinicalRecord=z.object({
 kind:z.enum(recordKinds),name:z.string().trim().min(1).max(160),detail:z.string().max(3000).nullable(),
 phase:z.enum(['administered','discharge','current','historical','unknown']),certainty:z.enum(['confirmed','suspected','unknown']),
 originalValue:z.string().max(500).nullable(),numericValue:z.string().regex(/^-?\d{1,12}(\.\d{1,12})?$/).nullable(),
 unit:z.string().max(40).nullable(),referenceRange:z.string().max(300).nullable(),
 dose:z.string().max(300).nullable(),frequency:z.string().max(300).nullable(),route:z.string().max(120).nullable(),
 evidence:z.string().trim().min(1).max(500),page:z.string().max(40).nullable()
}).strict().superRefine((x,c)=>{if(x.kind==='measurement'&&!x.originalValue?.trim())c.addIssue({code:'custom',message:'Falta el resultado documentado',path:['originalValue']})});
export type ClinicalRecord=z.infer<typeof clinicalRecord>;
const nullable={type:['string','null']};
export const clinicalRecordsJsonSchema={type:'array',items:{type:'object',additionalProperties:false,properties:{
 kind:{type:'string',enum:recordKinds},name:{type:'string'},detail:nullable,
 phase:{type:'string',enum:['administered','discharge','current','historical','unknown']},certainty:{type:'string',enum:['confirmed','suspected','unknown']},
 originalValue:nullable,numericValue:nullable,unit:nullable,referenceRange:nullable,dose:nullable,frequency:nullable,route:nullable,evidence:{type:'string'},page:nullable
},required:['kind','name','detail','phase','certainty','originalValue','numericValue','unit','referenceRange','dose','frequency','route','evidence','page']}};

import {z} from 'zod';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s)));
export const patientInput=z.object({
  name:z.string().trim().min(1).max(120),birthDate:date.nullish(),sex:z.string().trim().max(40).nullish(),
  bloodGroup:z.string().trim().max(20).nullish(),phone:z.string().trim().max(60).nullish(),
  contact:z.string().trim().max(150).nullish(),profileNote:z.string().trim().max(4000).nullish()
}).strict();
export const patientCreate=patientInput.extend({authorizedBy:z.string().trim().min(1).max(200),basis:z.string().trim().min(1).max(500)});
export const patientUpdate=patientInput.partial().extend({version:z.number().int().positive(),archived:z.boolean().optional()});
export const consultationInput=z.object({
  requestKey:z.string().uuid(),eventDate:date.nullish(),doctorId:z.string().uuid().nullish(),centerId:z.string().uuid().nullish(),
  specialtyId:z.string().uuid().nullish(),doctorAsDocumented:z.string().max(160).nullish(),centerAsDocumented:z.string().max(160).nullish(),
  reason:z.string().max(3000).nullish(),symptoms:z.string().max(5000).nullish(),summary:z.string().max(8000).nullish(),
  findings:z.string().max(8000).nullish(),impression:z.string().max(5000).nullish(),conclusion:z.string().max(8000).nullish(),
  recommendations:z.string().max(8000).nullish(),followUp:z.string().max(3000).nullish(),
  status:z.enum(['draft','published']).default('draft')
}).strict();
export const treatmentBase=z.object({
  requestKey:z.string().uuid(),consultationId:z.string().uuid().nullish(),name:z.string().trim().min(1).max(200),
  indication:z.string().max(3000).nullish(),doctorId:z.string().uuid().nullish(),startDate:date.nullish(),endDate:date.nullish(),
  state:z.enum(['planned','active','completed','suspended','paused','unknown']).default('unknown'),
  instructions:z.string().max(5000).nullish(),note:z.string().max(5000).nullish(),
  status:z.enum(['draft','published']).default('draft')
}).strict();
export const treatmentInput=treatmentBase.refine(p=>!p.startDate||!p.endDate||p.endDate>=p.startDate,'La fecha final precede al inicio');

import {z} from 'zod';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>{const d=new Date(x+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===x},'Fecha inválida');
export const careTaskFields=z.object({
 kind:z.enum(['consultation','examination']),title:z.string().trim().min(1).max(200),
 scheduledDate:date.nullable(),scheduledTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
 doctorId:z.string().uuid().nullable(),centerId:z.string().uuid().nullable(),specialtyId:z.string().uuid().nullable(),
 notes:z.string().trim().max(4000).nullable(),status:z.enum(['pending','completed','cancelled'])
}).strict();
export const createCareTask=careTaskFields.extend({requestKey:z.string().uuid()}).strict().refine(x=>!x.scheduledTime||!!x.scheduledDate,{message:'Selecciona fecha antes de indicar la hora',path:['scheduledDate']});
export const updateCareTask=careTaskFields.extend({version:z.number().int().positive()}).strict().refine(x=>!x.scheduledTime||!!x.scheduledDate,{message:'Selecciona fecha antes de indicar la hora',path:['scheduledDate']});

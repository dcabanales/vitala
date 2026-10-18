import {query} from './db';
export type SavedClinicalItem={id:string;kind:string;name:string;detail:string|null;status:string;href:string;value?:string|null;unit?:string|null;reference?:string|null};
export async function savedClinicalItems(patientId:string,role:'admin'|'patient',scope:{documentId?:string;consultationId?:string;examinationId?:string},includeWithdrawn=false):Promise<SavedClinicalItem[]>{
 const field=scope.documentId?'document_id':scope.consultationId?'consultation_id':'examination_id',target=scope.documentId||scope.consultationId||scope.examinationId;
 if(!target)return [];
 const root='/patients/'+patientId;
 const configs=[
  ['allergy','allergies','r.substance',"concat_ws(' · ',r.reaction,r.severity)",'conditions'],
  ['condition','patient_conditions','(SELECT name FROM medical_conditions WHERE id=r.condition_id)','r.note','conditions'],
  ['history','medical_history_events','r.title','r.detail','conditions'],
  ['treatment','treatments','r.name','r.instructions','treatments'],
  ['medication','patient_medications','(SELECT name FROM medications WHERE id=r.medication_id)',"concat_ws(' · ',r.dose,r.frequency,r.route)",'medications'],
  ['examination','examinations','r.name','r.findings','exams']
 ];
 const groups=await Promise.all(configs.map(async([kind,table,name,detail,section])=>{
  const rows=(await query(`SELECT DISTINCT r.id,${name} AS name,${detail} AS detail,r.status FROM ${table} r JOIN consultation_import_records i ON i.resource_id=r.id AND i.patient_id=r.patient_id AND i.kind=$3 WHERE i.patient_id=$1 AND i.${field}=$2 AND ($4='admin' OR r.status='published') AND ($5 OR r.status<>'void') ORDER BY r.id`,[patientId,target,kind,role,includeWithdrawn])).rows;
  return rows.map(r=>({id:r.id,kind,name:r.name,detail:r.detail?.split('\nFuente:')[0]||null,status:r.status,href:root+'/'+section+(kind==='examination'?'/'+r.id:kind==='treatment'?'#'+r.id:'')}));
 }));
 const measurements=(await query(`SELECT m.id,COALESCE(m.name_as_documented,t.name) AS name,m.original_value AS value,m.unit,m.reference_range AS reference,m.status FROM measurements m JOIN measurement_types t ON t.id=m.type_id WHERE m.patient_id=$1 AND m.${field}=$2 AND ($3='admin' OR m.status='published') AND ($4 OR m.status<>'void') AND (m.examination_id IS NULL OR EXISTS(SELECT 1 FROM examinations e WHERE e.id=m.examination_id AND e.patient_id=m.patient_id AND ($3='admin' OR e.status='published'))) AND (m.consultation_id IS NULL OR EXISTS(SELECT 1 FROM consultations c WHERE c.id=m.consultation_id AND c.patient_id=m.patient_id AND ($3='admin' OR c.status='published'))) ORDER BY m.created_at,m.id`,[patientId,target,role,includeWithdrawn])).rows.map(r=>({id:r.id,kind:'measurement',name:r.name,detail:null,value:r.value,unit:r.unit,reference:r.reference,status:r.status,href:root+'/exams#mediciones'}));
 return [...groups.flat(),...measurements];
}

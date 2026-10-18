import {createHash} from 'node:crypto';
import {transaction,query} from './db';
export type SummarySource=Record<string,Record<string,unknown>[]>;
export function summaryFingerprint(source:SummarySource){return createHash('sha256').update('vitala-summary-v1\n'+JSON.stringify(source)).digest('hex')}
export async function patientSummarySource(id:string):Promise<SummarySource>{
 return transaction(async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const queries:Record<string,string>={
   profile:"SELECT extract(year from age(birth_date))::int AS age,sex,blood_group,profile_note FROM patients WHERE id=$1",
   conditions:"SELECT m.name,p.state,p.certainty,p.note,p.documented_date FROM patient_conditions p JOIN medical_conditions m ON m.id=p.condition_id WHERE p.patient_id=$1 AND p.status='published' ORDER BY p.id",
   allergies:"SELECT substance,kind,reaction,state,documented_date FROM allergies WHERE patient_id=$1 AND status='published' ORDER BY id",
   history:"SELECT kind,title,detail,documented_date FROM medical_history_events WHERE patient_id=$1 AND status='published' ORDER BY id",
   treatments:"SELECT name,state,indication,instructions,start_date,end_date FROM treatments WHERE patient_id=$1 AND status='published' ORDER BY id",
   medications:"SELECT m.name,p.dose,p.frequency,p.route,p.instructions,p.state,p.start_date,p.end_date FROM patient_medications p JOIN medications m ON m.id=p.medication_id WHERE p.patient_id=$1 AND p.status='published' ORDER BY p.id",
   consultations:"SELECT event_date,reason,summary,findings,impression,conclusion,recommendations,follow_up FROM consultations WHERE patient_id=$1 AND status='published' ORDER BY id",
   examinations:"SELECT name,event_date,indication,findings,conclusion FROM examinations WHERE patient_id=$1 AND status='published' ORDER BY id",
   measurements:"SELECT COALESCE(m.name_as_documented,t.name) AS name,m.original_value,m.unit,m.reference_range,m.documented_date FROM measurements m JOIN measurement_types t ON t.id=m.type_id WHERE m.patient_id=$1 AND m.status='published' AND (m.examination_id IS NULL OR EXISTS(SELECT 1 FROM examinations e WHERE e.id=m.examination_id AND e.patient_id=m.patient_id AND e.status='published')) AND (m.consultation_id IS NULL OR EXISTS(SELECT 1 FROM consultations v WHERE v.id=m.consultation_id AND v.patient_id=m.patient_id AND v.status='published')) ORDER BY m.id"
  };
  const source:SummarySource={};for(const [key,sql] of Object.entries(queries))source[key]=(await c.query(sql,[id])).rows;
  return source;
 });
}
export async function patientSummaryView(id:string){
 const source=await patientSummarySource(id),hash=summaryFingerprint(source);
 const cached=(await query<{content:string;created_at:Date}>("SELECT content,created_at FROM patient_summaries WHERE patient_id=$1 AND source_hash=$2 AND status='completed' ORDER BY created_at DESC LIMIT 1",[id,hash])).rows[0];
 const previous=!!(await query("SELECT 1 FROM patient_summaries WHERE patient_id=$1 AND status='completed' LIMIT 1",[id])).rowCount;
 const count=Object.entries(source).filter(([k])=>k!=='profile').reduce((n,[,rows])=>n+rows.length,0);
 const conditions=source.conditions.filter(x=>x.state!=='resolved').map(x=>String(x.name)+(x.certainty==='suspected'?' (sospecha documentada)':'')).slice(0,4);
 const allergies=source.allergies.filter(x=>x.state!=='resolved').map(x=>String(x.substance)).slice(0,4);
 const fallback=[conditions.length?'Condiciones registradas: '+conditions.join(', ')+'.':null,allergies.length?'Alergias o intolerancias registradas: '+allergies.join(', ')+'.':null,count?source.consultations.length+' consultas y '+source.examinations.length+' exámenes publicados.':'Todavía no hay datos clínicos publicados para resumir.'].filter(Boolean).join(' ');
 return {cached,stale:!cached&&previous,hasData:count>0,fallback};
}

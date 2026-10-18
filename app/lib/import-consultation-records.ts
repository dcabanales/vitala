import {clinicalIdentity,clinicalImportKey,normalizeImported} from './import-identity';
import type {PoolClient} from 'pg';
import type {ClinicalRecord} from './consultation-records';
export async function resolveImportedMeasurementType(c:PoolClient,name:string,kind:'number'|'text'){
 const match=(await c.query('SELECT id FROM measurement_types WHERE lower(name)=lower($1) AND value_kind=$2 AND active LIMIT 1',[name,kind])).rows[0];if(match)return match.id as string;
 const fallback=`Resultado importado (${kind==='number'?'numérico':'texto'})`;
 const type=(await c.query("INSERT INTO measurement_types(name,category,value_kind) VALUES($1,'other',$2) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id,value_kind,active",[fallback,kind])).rows[0];
 if(type.value_kind!==kind||!type.active)throw Error('VALIDATION');return type.id as string;
}
export async function importConsultationRecords(c:PoolClient,args:{doctorId?:string|null;doctorName?:string|null;patientId:string;consultationId:string|null;examinationId?:string;documentId:string;actorId:string;date:string|null;records:ClinicalRecord[]}){
 const {patientId:p,consultationId:visit,documentId:doc,actorId:actor,date}=args;
 const phaseLabels={administered:'Administrado durante la atención',discharge:'Indicado al alta; vigencia actual no establecida',current:'Uso documentado en la fecha de la consulta',historical:'Antecedente documentado',unknown:'Vigencia no documentada'};
 const prior=(await c.query('SELECT kind,snapshot FROM consultation_import_records WHERE patient_id=$1 AND document_id=$2',[p,doc])).rows;
 const confirmed=(await c.query("SELECT draft FROM extraction_runs WHERE patient_id=$1 AND document_id=$2 AND status='confirmed'",[p,doc])).rows;
 const knownVariants=new Set(confirmed.flatMap(r=>(r.draft?.clinicalRecords||[]).map((x:ClinicalRecord)=>clinicalIdentity(x))));
 const seen=new Set(prior.map(r=>clinicalIdentity(r.snapshot as ClinicalRecord)));
 let imported=0;
 for(const x of args.records){
  const identity=clinicalIdentity(x),nameKey=clinicalImportKey(x);
  if(seen.has(identity))continue;
  if(!knownVariants.has(identity)&&prior.some(r=>r.kind===x.kind&&normalizeImported(r.snapshot.name)===normalizeImported(x.name)))throw Error('IMPORT_CONFLICT:'+x.name);
  seen.add(identity);
  const note=[x.detail,phaseLabels[x.phase],`Fuente: ${doc}${x.page?' · pág. '+x.page:''}`,`Cita: ${x.evidence}`].filter(Boolean).join('\n');
  const state=x.phase==='administered'||x.phase==='historical'?'completed':'unknown';let resource:string;
  if(x.kind==='allergy'){
   const old=(await c.query("SELECT id FROM allergies WHERE patient_id=$1 AND lower(substance)=lower($2) AND status<>'void' LIMIT 1 FOR UPDATE",[p,x.name])).rows[0];
   resource=old?.id||(await c.query("INSERT INTO allergies(patient_id,substance,kind,state,documented_date,source_note) VALUES($1,$2,$3,'unknown',$4,$5) RETURNING id",[p,x.name,/intolerancia/i.test(x.detail||'')?'intolerance':'allergy',date,note])).rows[0].id;
  }else if(x.kind==='condition'){
   const cat=(await c.query('INSERT INTO medical_conditions(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[x.name])).rows[0].id;
   const old=(await c.query("SELECT id FROM patient_conditions WHERE patient_id=$1 AND condition_id=$2 AND status<>'void' LIMIT 1 FOR UPDATE",[p,cat])).rows[0];
   resource=old?.id||(await c.query("INSERT INTO patient_conditions(patient_id,condition_id,consultation_id,state,certainty,documented_date,note,source_note) VALUES($1,$2,$3,'unknown',$4,$5,$6,$7) RETURNING id",[p,cat,visit,x.certainty,date,x.detail,note])).rows[0].id;
  }else if(x.kind==='history'){
   resource=(await c.query("INSERT INTO medical_history_events(patient_id,kind,title,detail,documented_date,document_id,created_by) VALUES($1,'personal',$2,$3,$4,$5,$6) RETURNING id",[p,x.name,note,date,doc,actor])).rows[0].id;
  }else if(x.kind==='treatment'||x.kind==='medication'){
   const treatment=(await c.query("INSERT INTO treatments(patient_id,consultation_id,name,state,instructions,note,status,created_by,doctor_id,doctor_as_documented) VALUES($1,$2,$3,$4,$5,$6,'published',$7,$8,$9) RETURNING id",[p,visit,x.name,state,x.detail,note,actor,args.doctorId||null,args.doctorName||null])).rows[0].id;
   resource=treatment;
   if(x.kind==='medication'){
    const cat=(await c.query('INSERT INTO medications(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[x.name])).rows[0].id;
    resource=(await c.query("INSERT INTO patient_medications(patient_id,medication_id,treatment_id,dose,frequency,route,instructions,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[p,cat,treatment,x.dose,x.frequency,x.route,note,state])).rows[0].id;
   }
  }else if(x.kind==='examination'){
   resource=(await c.query("INSERT INTO examinations(patient_id,consultation_id,name,event_date,findings,status,created_by) VALUES($1,$2,$3,$4,$5,'published',$6) RETURNING id",[p,visit,x.name,date,note,actor])).rows[0].id;
   await c.query('INSERT INTO examination_documents(patient_id,examination_id,document_id) VALUES($1,$2,$3)',[p,resource,doc]);
  }else{
   const kind=x.numericValue!==null?'number':'text';
   // Catalog category must never erase the documented name or force an incompatible value kind.
   const typeId=await resolveImportedMeasurementType(c,x.name,kind);
   resource=(await c.query("INSERT INTO measurements(patient_id,type_id,consultation_id,examination_id,document_id,documented_date,value_kind,numeric_value,text_value,original_value,unit,reference_range,context_note,status,created_by,name_as_documented) VALUES($1,$2,$3,$15,$4,$5,$6,$7,$8,$9,$10,$11,$12,'published',$13,$14) RETURNING id",[p,typeId,visit,doc,date,kind,x.numericValue,kind==='text'?x.originalValue:null,x.originalValue,x.unit,x.referenceRange,note,actor,x.name,args.examinationId||null])).rows[0].id;
  }
  await c.query('INSERT INTO consultation_import_records(patient_id,consultation_id,document_id,kind,name_key,resource_id,snapshot,created_by,examination_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[p,visit,doc,x.kind,nameKey,resource,x,actor,args.examinationId||null]);
  await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'import_document_record',$2,$3,$4)",[actor,x.kind,resource,p]);imported++;
 }
 return imported;
}

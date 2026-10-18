import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
const tables={consultation:'consultations',examination:'examinations',treatment:'treatments',medication:'patient_medications',allergy:'allergies',condition:'patient_conditions',history:'medical_history_events',measurement:'measurements',task:'care_tasks'} as const;
type Kind=keyof typeof tables;
type Row=Record<string,unknown>&{id:string;status:string;version:number};
type Entry={kind:Kind;id:string;label:string;row:Row;created:string;sources:Set<string>;owned:boolean;reason:string|null};
type Saved={kind:Kind;id:string;before:Row;after:Row};
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function label(kind:Kind,row:Row){return String(row.name||row.title||row.substance||row.name_as_documented||row.reason||row.original_value||({condition:'Condición registrada',medication:'Medicación registrada',consultation:'Consulta',examination:'Examen'} as Record<string,string>)[kind]||'Registro')}
async function document(c:PoolClient,patientId:string,documentId:string){
 const d=(await c.query('SELECT * FROM medical_documents WHERE patient_id=$1 AND id=$2 FOR UPDATE',[patientId,documentId])).rows[0];if(!d)throw Error('PATIENT');
 if((await c.query("SELECT 1 FROM extraction_runs WHERE patient_id=$1 AND document_id=$2 AND status='running' AND created_at>now()-interval '3 minutes'",[patientId,documentId])).rowCount)throw Error('DOCUMENT_BUSY');
 return d;
}
export async function withdrawalPreview(c:PoolClient,patientId:string,documentId:string){
 const doc=await document(c,patientId,documentId);
 const batch=(await c.query('SELECT id,items FROM document_withdrawals WHERE patient_id=$1 AND document_id=$2 AND restored_at IS NULL',[patientId,documentId])).rows[0];
 if(batch)return {token:digest({batch:batch.id}),withdrawn:true,items:[],tasks:[],batchId:batch.id,entries:[] as Entry[],taskRows:[] as Row[],doc};
 // Lock clinical rows before inspecting shared references; FK writers must wait for these locks.
 const entries:Entry[]=[];
 for(const [kind,table] of Object.entries(tables)){
  if(kind==='task')continue;
  const catalog=kind==='condition'?"(SELECT name FROM medical_conditions WHERE id=t.condition_id)":kind==='medication'?"(SELECT name FROM medications WHERE id=t.medication_id)":'NULL';
  const rows=(await c.query(`SELECT ${catalog} AS catalog_name,to_jsonb(t) AS data,t.created_at::text AS created FROM ${table} t WHERE patient_id=$1 ORDER BY id FOR UPDATE`,[patientId])).rows;
  for(const x of rows)entries.push({kind:kind as Kind,id:x.data.id,label:x.catalog_name||label(kind as Kind,x.data),row:x.data,created:x.created,sources:new Set(),owned:false,reason:null});
 }
 const map=new Map(entries.map(e=>[e.kind+':'+e.id,e]));
 const imports=(await c.query('SELECT *,created_at::text AS created FROM consultation_import_records WHERE patient_id=$1 ORDER BY id',[patientId])).rows;
 for(const x of imports){const e=map.get(x.kind+':'+x.resource_id);if(!e)continue;e.sources.add(x.document_id);
  // Old imports lack a creation flag. Exact transaction time plus original source text proves creation for reused facts.
  const own=x.document_id===documentId&&e.created===x.created&&(!['condition','allergy'].includes(e.kind)||String(e.row.source_note||'').includes('Fuente: '+documentId));if(own)e.owned=true;
  if(e.kind==='medication'&&e.row.treatment_id){const t=map.get('treatment:'+e.row.treatment_id);if(t){t.sources.add(x.document_id);if(own&&t.created===e.created)t.owned=true}}
 }
 const runs=(await c.query("SELECT *,finished_at::text AS finished FROM extraction_runs WHERE patient_id=$1 AND status='confirmed'",[patientId])).rows;
 for(const x of runs){for(const kind of ['consultation','examination'] as const){const e=map.get(kind+':'+x[kind+'_id']);if(e){e.sources.add(x.document_id);if(x.document_id===documentId&&e.created===x.finished)e.owned=true}}}
 for(const kind of ['consultation','examination'] as const){const links=(await c.query(`SELECT ${kind}_id AS id,document_id FROM ${kind}_documents WHERE patient_id=$1`,[patientId])).rows;for(const l of links)map.get(kind+':'+l.id)?.sources.add(l.document_id)}
 const restorations=(await c.query('SELECT items FROM document_withdrawals WHERE patient_id=$1 AND document_id=$2 AND restored_at IS NOT NULL ORDER BY restored_at DESC',[patientId,documentId])).rows;
 const restored=new Map<string,Saved>();for(const batch of restorations)for(const item of batch.items as Saved[]){const key=item.kind+':'+item.id;if(!restored.has(key))restored.set(key,item)}
 const content=(row:Row)=>{const {version,...fields}=row;return digest(fields)};
 for(const e of entries){if(typeof e.row.document_id==='string')e.sources.add(e.row.document_id);
  if(e.kind==='measurement'&&e.row.document_id===documentId&&runs.some(r=>r.document_id===documentId&&r.finished===e.created))e.owned=true;
  if(!e.sources.has(documentId))e.reason='No fue creado por este documento';
  else if(e.row.status==='void')e.reason='Ya estaba retirado';
  else if(e.sources.size>1)e.reason='Está asociado a otros documentos';
  else if(!e.owned)e.reason='Era previo o no se puede confirmar su origen exclusivo';
  else if(e.row.version!==1&&!(restored.has(e.kind+':'+e.id)&&e.row.version===restored.get(e.kind+':'+e.id)!.after.version+1&&content(e.row)===content(restored.get(e.kind+':'+e.id)!.before)))e.reason='Fue editado después de importarlo';
 }
 // Preserve ancestors of retained records so their details remain reachable.
 const parents=(e:Entry)=>[['consultation',e.row.consultation_id],['examination',e.row.examination_id],['treatment',e.row.treatment_id]].filter(([,id])=>id).map(([kind,id])=>map.get(kind+':'+id)).filter((p):p is Entry=>!!p);
 let changed=true;while(changed){changed=false;for(const child of entries){if(child.row.status==='void'||!child.reason)continue;for(const parent of parents(child)){if(!parent.reason){parent.reason='Contiene registros que deben conservarse';changed=true}}}}
 const selected=entries.filter(e=>e.sources.has(documentId));
 const taskRows=(await c.query('SELECT to_jsonb(t) AS data FROM care_tasks t WHERE patient_id=$1 AND document_id=$2 ORDER BY id FOR UPDATE',[patientId,documentId])).rows.map(x=>x.data as Row).filter(t=>entries.some(e=>!e.reason&&(e.id===t.consultation_id||e.id===t.examination_id)));
 const items=selected.map(e=>({kind:e.kind,id:e.id,label:e.label,action:e.reason?'keep':'withdraw',reason:e.reason}));
 const tasks=taskRows.map(t=>({id:t.id,title:t.title}));
 return {token:digest({archived:doc.archived_at,entries:selected.map(e=>({kind:e.kind,row:e.row,sources:[...e.sources].sort(),reason:e.reason})),tasks:taskRows}),withdrawn:false,items,tasks,entries:selected,taskRows,doc,batchId:null};
}
export async function withdrawDocument(c:PoolClient,patientId:string,documentId:string,actorId:string,token:string){
 const plan=await withdrawalPreview(c,patientId,documentId);if(plan.withdrawn)throw Error('CONFLICT');if(plan.token!==token)throw Error('WITHDRAWAL_CHANGED');
 const saved:Saved[]=[];
 for(const e of plan.entries.filter(e=>!e.reason)){
  const after=(await c.query(`UPDATE ${tables[e.kind]} SET status='void',version=version+1 WHERE patient_id=$1 AND id=$2 RETURNING to_jsonb(${tables[e.kind]}) AS data`,[patientId,e.id])).rows[0].data;
  saved.push({kind:e.kind,id:e.id,before:e.row,after});
 }
 for(const t of plan.taskRows){const after=(await c.query("UPDATE care_tasks SET status='pending',consultation_id=NULL,examination_id=NULL,version=version+1,updated_at=now() WHERE patient_id=$1 AND id=$2 RETURNING to_jsonb(care_tasks) AS data",[patientId,t.id])).rows[0].data;saved.push({kind:'task',id:t.id,before:t,after})}
 await c.query('UPDATE medical_documents SET archived_at=now(),updated_at=now() WHERE patient_id=$1 AND id=$2',[patientId,documentId]);
 const batch=(await c.query('INSERT INTO document_withdrawals(patient_id,document_id,items,created_by) VALUES($1,$2,$3,$4) RETURNING id',[patientId,documentId,JSON.stringify(saved),actorId])).rows[0];
 await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'withdraw_document_data','document',$2,$3)",[actorId,documentId,patientId]);
 return {batchId:batch.id,withdrawn:saved.filter(x=>x.kind!=='task').length,kept:plan.items.filter(x=>x.action==='keep').length};
}
export async function restoreWithdrawal(c:PoolClient,patientId:string,documentId:string,actorId:string){
 await document(c,patientId,documentId);
 const batch=(await c.query('SELECT * FROM document_withdrawals WHERE patient_id=$1 AND document_id=$2 AND restored_at IS NULL FOR UPDATE',[patientId,documentId])).rows[0];if(!batch)throw Error('CONFLICT');
 const saved=batch.items as Saved[];
 // Restore only the untouched rows from this batch, never overwrite subsequent changes.
 for(const item of saved){if(!Object.hasOwn(tables,item.kind))throw Error('CONFLICT');const row=(await c.query(`SELECT to_jsonb(t) AS data FROM ${tables[item.kind]} t WHERE patient_id=$1 AND id=$2 FOR UPDATE`,[patientId,item.id])).rows[0]?.data;if(digest(row)!==digest(item.after))throw Error('RESTORE_CHANGED')}
 for(const item of saved){
  for(const [kind,field] of [['consultation','consultation_id'],['examination','examination_id'],['treatment','treatment_id']] as const){const parentId=item.before[field];if(!parentId||saved.some(s=>s.kind===kind&&s.id===parentId))continue;
   const parent=(await c.query(`SELECT status FROM ${tables[kind]} WHERE patient_id=$1 AND id=$2 FOR SHARE`,[patientId,parentId])).rows[0];if(!parent||parent.status==='void')throw Error('RESTORE_CHANGED');
  }
 }
 for(const item of saved){if(item.kind==='task')await c.query('UPDATE care_tasks SET status=$3,consultation_id=$4,examination_id=$5,version=version+1,updated_at=now() WHERE patient_id=$1 AND id=$2',[patientId,item.id,item.before.status,item.before.consultation_id,item.before.examination_id]);
  else await c.query(`UPDATE ${tables[item.kind]} SET status=$3,version=version+1 WHERE patient_id=$1 AND id=$2`,[patientId,item.id,item.before.status]);
 }
 await c.query('UPDATE medical_documents SET archived_at=NULL,updated_at=now() WHERE patient_id=$1 AND id=$2',[patientId,documentId]);
 await c.query('UPDATE document_withdrawals SET restored_at=now(),restored_by=$2 WHERE id=$1',[batch.id,actorId]);
 await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'restore_document_data','document',$2,$3)",[actorId,documentId,patientId]);
 return {restored:saved.length};
}

import {transaction} from './db';
export async function reviseRecord(args:{table:'measurements'|'patient_medications';resource:'measurement'|'medication_use';patientId:string;actorId:string;recordId:string;version:number;reason:string;changes:Record<string,unknown>;columns:Record<string,string>}){
 return transaction(async client=>{
 const old=(await client.query(`SELECT * FROM ${args.table} WHERE patient_id=$1 AND id=$2 AND status<>'void' FOR UPDATE`,[args.patientId,args.recordId])).rows[0];
 if(!old)throw Error('PATIENT');if(old.version!==args.version)throw Error('CONFLICT');
 const next={...old};const values:unknown[]=[args.patientId,args.recordId,args.version],sets:string[]=[];
 for(const [key,column] of Object.entries(args.columns)){if(Object.hasOwn(args.changes,key)){const value=args.changes[key]??null;next[column]=value;values.push(value);sets.push(`${column}=$${values.length}`)}}
 if(!sets.length)throw Error('VALIDATION');
 if(next.start_date&&next.end_date&&String(next.end_date).slice(0,10)<String(next.start_date).slice(0,10))throw Error('VALIDATION');
 if(args.table==='measurements'&&next.status==='published'){
  for(const [field,table] of [['consultation_id','consultations'],['examination_id','examinations']]){if(next[field]&&(await client.query(`SELECT status FROM ${table} WHERE patient_id=$1 AND id=$2 FOR SHARE`,[args.patientId,next[field]])).rows[0]?.status!=='published')throw Error('VALIDATION')}
 }
 await client.query(`INSERT INTO clinical_fact_revisions(patient_id,resource_type,resource_id,previous_version,snapshot,reason,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[args.patientId,args.resource,args.recordId,args.version,old,args.reason,args.actorId]);
 const result=await client.query(`UPDATE ${args.table} SET ${sets.join(',')},version=version+1 WHERE patient_id=$1 AND id=$2 AND version=$3 RETURNING id,version`,values);
 await client.query(`INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'update',$2,$3,$4)`,[args.actorId,args.resource,args.recordId,args.patientId]);return result.rows[0];
 });
}

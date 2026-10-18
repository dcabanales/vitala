import type {PoolClient} from 'pg';
export async function completeCareTask(c:PoolClient,patientId:string,documentId:string,kind:'consultation'|'examination',recordId:string,actorId:string){
 const task=(await c.query('SELECT * FROM care_tasks WHERE patient_id=$1 AND document_id=$2 FOR UPDATE',[patientId,documentId])).rows[0];if(!task)return;
 if(task.kind!==kind)throw Error('TASK_KIND');
 if(task.consultation_id||task.examination_id){if((task.consultation_id||task.examination_id)===recordId)return;throw Error('CONFLICT')}
 if(task.status!=='pending')throw Error('TASK_STATE');
 await c.query("UPDATE care_tasks SET status='completed',consultation_id=$2,examination_id=$3,version=version+1,updated_at=now() WHERE id=$1",[task.id,kind==='consultation'?recordId:null,kind==='examination'?recordId:null]);
 await c.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,patient_id) VALUES($1,'complete_from_document','care_task',$2,$3)",[actorId,task.id,patientId]);
}

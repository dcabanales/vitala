import {query} from './db';
import type {User} from './auth';

// Resolve ownership from the authenticated account, never from a submitted patient id.
export async function personalPatientId(user:User):Promise<string|null>{
 if(user.role!=='patient')return null;
 const r=await query<{id:string}>(`SELECT p.id FROM patients p JOIN patient_access_grants g ON g.patient_id=p.id AND g.user_id=$1
 WHERE p.patient_user_id=$1 AND p.archived_at IS NULL AND g.revoked_at IS NULL
 AND (g.expires_at IS NULL OR g.expires_at>now())`,[user.id]);
 return r.rows[0]?.id||null;
}
export async function landingPath(user:User){
 if(user.role==='admin')return '/patients';
 const id=await personalPatientId(user);return id?`/patients/${id}`:'/access-unavailable';
}

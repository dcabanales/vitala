import {clinicalDate,ageYears} from '../../../lib/labels';
import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '../../../lib/auth';
import {authorizePatient} from '../../../lib/server';
import {query} from '../../../lib/db';
import {ProfileEditor} from '../profile-editor';
import {InvitePatient} from '../invite-patient';
import {AccessGrants} from '../access-grants';
import {PatientRecovery} from '../patient-recovery';
import {PatientSummary} from '../patient-summary';
import {ClinicalFacts} from '../clinical-facts';
export const dynamic='force-dynamic';
export default async function PatientPage({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)redirect('/login');const {id}=await params;
  try{await authorizePatient(user,id)}catch{notFound()}
  const result=await query<{id:string;name:string;birthDate:string|null;sex:string|null;bloodGroup:string|null;phone:string|null;contact:string|null;profileNote:string|null;archivedAt:string|null;patientUserId:string|null;version:number}>(`SELECT id,name,birth_date AS "birthDate",sex,blood_group AS "bloodGroup",phone,contact,profile_note AS "profileNote",archived_at AS "archivedAt",patient_user_id AS "patientUserId",version FROM patients WHERE id=$1`,[id]);
  const p=result.rows[0];if(!p)notFound();const age=ageYears(p.birthDate);
  return <main className="v-main"><h1>{user.role==='admin'?'Perfil y acceso':'Mi perfil'}</h1><p className="v-muted">{user.role==='admin'?'Datos personales y administración del expediente.':'Tus datos personales registrados.'}</p><section className="v-panel"><h2>Perfil del paciente</h2><dl className="v-details"><div><dt>Nacimiento</dt><dd>{p.birthDate?clinicalDate(p.birthDate):'No documentado'}</dd></div><div><dt>Edad</dt><dd>{age===null?'No documentada':`${age} años`}</dd></div><div><dt>Sexo</dt><dd>{p.sex||'No documentado'}</dd></div><div><dt>Grupo sanguíneo</dt><dd>{p.bloodGroup||'No documentado'}</dd></div><div><dt>Teléfono</dt><dd>{p.phone||'No documentado'}</dd></div><div><dt>Contacto</dt><dd>{p.contact||'No documentado'}</dd></div></dl>{p.profileNote&&<p className="v-note">{p.profileNote}</p>}</section>{user.role==='admin'&&<><section className="v-panel"><h2>Administrar perfil y acceso</h2><ProfileEditor patient={p}/><InvitePatient patientId={id}/>{p.patientUserId&&<PatientRecovery patientId={id}/>}<AccessGrants patientId={id} currentUserId={user.id}/></section></>}</main>}

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
import pg from 'pg';
import {totp} from '../app/lib/mfa.ts';

const base=process.env.SMOKE_BASE_URL,email=process.env.SMOKE_ADMIN_EMAIL,password=process.env.SMOKE_ADMIN_PASSWORD;
const enabled=!!base&&!!email&&!!password&&['localhost','127.0.0.1'].includes(new URL(base||'http://invalid.example').hostname);
const localDb=!!process.env.SMOKE_DATABASE_URL&&['localhost','127.0.0.1'].includes(new URL(process.env.SMOKE_DATABASE_URL||'postgresql://invalid.example').hostname);
test.beforeEach(async()=>{
  if(!enabled||!localDb)return;
  const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});
  try{await pool.query('DELETE FROM login_limits')}finally{await pool.end()}
});
const client=()=>({cookie:''});
async function request(actor,path,options={}){
  const r=await fetch(base+path,{redirect:'manual',...options,headers:{...(actor.cookie?{cookie:actor.cookie}:{}),...options.headers}});
  const cookie=r.headers.get('set-cookie');if(cookie&&cookie.includes('vitala='))actor.cookie=cookie.split(';')[0];
  let body=null;const content=r.headers.get('content-type')||'';if(content.includes('application/json'))body=await r.json();else body=await r.text();
  return {status:r.status,body,headers:r.headers};
}
async function login(actor,loginEmail,loginPassword){
  const html=(await request(actor,'/login')).body,csrf=html.match(/name="csrfToken" value="([^"]+)"/)?.[1];assert.ok(csrf);
  const form=new URLSearchParams({email:loginEmail,password:loginPassword,csrfToken:csrf});
  const r=await request(actor,'/api/auth/login',{method:'POST',body:form,headers:{origin:'null'}});assert.equal(r.status,303);assert.ok(actor.cookie);return r;
}
async function token(actor){return (await request(actor,'/api/auth/csrf')).body.token}
async function post(actor,path,data){return request(actor,path,{method:'POST',body:JSON.stringify(data),headers:{'content-type':'application/json',origin:'null','x-csrf-token':await token(actor)}})}

test('aislamiento A/B, invitación, revocación y vínculos clínicos', {skip:!enabled}, async()=>{
  const admin=client();await login(admin,email,password);
  const suffix=randomUUID().slice(0,8),create=async name=>{
    const r=await post(admin,'/api/patients',{name,authorizedBy:'Paciente ficticio',basis:'Prueba local sintética'});
    assert.equal(r.status,201);return r.body.patient.id;
  };
  const a=await create('Prueba A '+suffix),b=await create('Prueba B '+suffix);
  if(localDb){
    const outsiderEmail=`outsider-${suffix}@example.test`,outsiderPassword='synthetic-outsider-password-123';
    const salt=randomBytes(16).toString('hex'),hash=`scrypt:${salt}:${scryptSync(outsiderPassword,salt,64).toString('hex')}`;
    const outsiderPool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});
    try{await outsiderPool.query("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin')",[outsiderEmail,hash])}finally{await outsiderPool.end()}
    const outsider=client();await login(outsider,outsiderEmail,outsiderPassword);
    assert.deepEqual((await request(outsider,'/api/patients')).body.patients,[]);
    assert.equal((await request(outsider,`/api/patients/${a}`)).status,404);
    assert.equal((await request(outsider,`/patients/${a}/report`)).status,404);
    const expired=await post(admin,`/api/patients/${b}/invitations`,{email:`expired-${suffix}@example.test`});
    assert.equal(expired.status,201);
    const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});
    try{await pool.query("UPDATE invitations SET expires_at=now()-interval '1 minute' WHERE patient_id=$1",[b])}finally{await pool.end()}
    const expiredToken=expired.body.invitationUrl.split('/').at(-1),expiredActor=client();
    const expiredHtml=(await request(expiredActor,'/invite/'+expiredToken)).body;
    const expiredCsrf=expiredHtml.match(/name="csrfToken" value="([^"]+)"/)?.[1];
    assert.equal((await request(expiredActor,'/api/auth/accept-invite',{method:'POST',body:new URLSearchParams({token:expiredToken,password:'synthetic-patient-password-123',csrfToken:expiredCsrf}),headers:{origin:'null'}})).status,400);
  }
  const badOrigin=await request(admin,'/api/patients',{method:'POST',body:'{}',headers:{origin:'https://ejemplo-malicioso.test','content-type':'application/json'}});
  assert.equal(badOrigin.status,403);
  const noToken=await request(admin,'/api/patients',{method:'POST',body:'{}',headers:{origin:'null','content-type':'application/json'}});
  assert.equal(noToken.status,403);
  const invite=await post(admin,`/api/patients/${a}/invitations`,{email:`patient-${suffix}@example.test`});assert.equal(invite.status,201);
  const inviteToken=invite.body.invitationUrl.split('/').at(-1),patient=client();
  const inviteHtml=(await request(patient,'/invite/'+inviteToken)).body,csrf=inviteHtml.match(/name="csrfToken" value="([^"]+)"/)?.[1];assert.ok(csrf);
  const accepted=await request(patient,'/api/auth/accept-invite',{method:'POST',body:new URLSearchParams({token:inviteToken,password:'synthetic-patient-password-123',csrfToken:csrf}),headers:{origin:'null'}});
  assert.equal(accepted.status,303);
  const reusedInvite=await request(client(),'/api/auth/accept-invite',{method:'POST',body:new URLSearchParams({token:inviteToken,password:'synthetic-patient-password-123',csrfToken:csrf}),headers:{origin:'null'}});
  assert.equal(reusedInvite.status,400);
  await login(patient,`patient-${suffix}@example.test`,'synthetic-patient-password-123');
  assert.equal((await request(patient,`/api/patients/${a}`)).status,200);
  assert.equal((await request(patient,`/api/patients/${b}`)).status,404);
  assert.equal((await request(patient,`/patients/${b}/report`)).status,404);
  assert.equal((await post(patient,`/api/patients/${a}/consultations`,{requestKey:randomUUID(),status:'published'})).status,404);
  const invalidForm=new FormData();invalidForm.append('file',new File(['documento falso'],'falso.pdf',{type:'application/pdf'}));
  const invalidUpload=await request(admin,`/api/patients/${b}/documents`,{
    method:'POST',body:invalidForm,headers:{origin:'null','x-csrf-token':await token(admin)}
  });
  assert.equal(invalidUpload.status,400);
  const pdfForm=new FormData();pdfForm.append('file',new File(['%PDF-1.4\n%%EOF'],'ajeno.pdf',{type:'application/pdf'}));
  const uploaded=await request(admin,`/api/patients/${b}/documents`,{method:'POST',body:pdfForm,headers:{origin:'null','x-csrf-token':await token(admin)}});
  assert.equal(uploaded.status,201);
  assert.equal((await request(patient,`/api/patients/${b}/documents/${uploaded.body.document.id}`)).status,404);
  const exam=await post(admin,`/api/patients/${a}/examinations`,{name:'Examen sintético',status:'published'});assert.equal(exam.status,201);
  const types=(await request(admin,'/api/measurement-types')).body.types,weight=types.find(t=>t.name==='Peso');
  const draftExam=await post(admin,`/api/patients/${a}/examinations`,{name:'Examen aún privado',status:'draft'});
  assert.equal(draftExam.status,201);
  const premature=await post(admin,`/api/patients/${a}/measurements`,{typeId:weight.id,examinationId:draftExam.body.examination.id,
    valueKind:'number',numericValue:'63.5',originalValue:'63,5 kg'});
  assert.equal(premature.status,400);
  const cross=await post(admin,`/api/patients/${b}/measurements`,{typeId:weight.id,examinationId:exam.body.examination.id,valueKind:'number',numericValue:'63.5',originalValue:'63,5 kg'});
  assert.equal(cross.status,400);
  const typeName='Marcador sintético '+suffix;
  const addedType=await post(admin,'/api/measurement-types',{name:typeName,category:'laboratory',valueKind:'number',defaultUnit:'U/L'});
  assert.equal(addedType.status,201);
  assert.equal((await post(patient,'/api/measurement-types',{name:'No autorizado',category:'other',valueKind:'text'})).status,403);
  const disabledType=await request(admin,'/api/measurement-types',{method:'PATCH',
    body:JSON.stringify({id:addedType.body.type.id,active:false}),
    headers:{origin:'null','content-type':'application/json','x-csrf-token':await token(admin)}});
  assert.equal(disabledType.status,200);
  assert.ok(!(await request(patient,'/api/measurement-types')).body.types.some(t=>t.id===addedType.body.type.id));
  assert.ok((await request(admin,'/api/measurement-types?all=1')).body.types.some(t=>t.id===addedType.body.type.id&&!t.active));
  assert.equal((await request(patient,'/api/backup')).status,404);
  const grants=(await request(admin,`/api/patients/${a}/grants`)).body.grants;
  const patientGrant=grants.find(g=>g.email===`patient-${suffix}@example.test`);assert.ok(patientGrant);
  const revoked=await request(admin,`/api/patients/${a}/grants`,{method:'PATCH',headers:{'content-type':'application/json',origin:'null','x-csrf-token':await token(admin)},body:JSON.stringify({userId:patientGrant.userId})});
  assert.equal(revoked.status,200);
  assert.equal((await request(patient,`/api/patients/${a}`)).status,401);
});

test('revisión de IA: identidad distinta bloqueada y confirmación idempotente', {skip:!enabled||!localDb}, async()=>{
  const admin=client();await login(admin,email,password);
  const name='Extracción sintética '+randomUUID().slice(0,8);
  const created=await post(admin,'/api/patients',{name,authorizedBy:'Paciente ficticio',basis:'Prueba local sintética'});
  assert.equal(created.status,201);const patientId=created.body.patient.id;
  const pdf=new File(['%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'],'consulta-ficticia.pdf',{type:'application/pdf'});
  const form=new FormData();form.append('file',pdf);
  const upload=await request(admin,`/api/patients/${patientId}/documents`,{
    method:'POST',body:form,headers:{origin:'null','x-csrf-token':await token(admin)}
  });
  assert.equal(upload.status,201);const documentId=upload.body.document.id;
  const draft={patientName:name,eventDate:null,doctorName:null,centerName:null,specialtyName:null,
    reason:null,symptoms:null,summary:'Consulta ficticia revisada',findings:null,impression:null,
    conclusion:null,recommendations:null,followUp:null,evidence:[]};
  const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});
  try{
    const actor=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
    const insert=async value=>(await pool.query(`INSERT INTO extraction_runs(patient_id,document_id,kind,status,model,schema_version,draft,created_by)
      VALUES($1,$2,'consultation','review','synthetic',1,$3,$4) RETURNING id`,[patientId,documentId,value,actor])).rows[0].id;
    const bad=await insert({...draft,patientName:'Otra persona'});
    const confirm=async runId=>post(admin,`/api/patients/${patientId}/extractions/${runId}/confirm`,{draft});
    assert.equal((await confirm(bad)).status,409);
    const good=await insert(draft),first=await confirm(good);
    assert.equal(first.status,200);assert.equal(first.body.consultation.alreadyConfirmed,false);
    const again=await confirm(good);
    assert.equal(again.status,200);assert.equal(again.body.consultation.id,first.body.consultation.id);
    assert.equal(again.body.consultation.alreadyConfirmed,true);
    const count=await pool.query('SELECT count(*)::int AS count FROM consultations WHERE patient_id=$1',[patientId]);
    assert.equal(count.rows[0].count,1);
  }finally{await pool.end()}
});

test('examen extraído: medición estructurada, hallazgo narrativo y revisión idempotente', {skip:!enabled||!localDb}, async()=>{
  const admin=client();await login(admin,email,password);
  const name='Examen sintético '+randomUUID().slice(0,8);
  const created=await post(admin,'/api/patients',{name,authorizedBy:'Paciente ficticio',basis:'Prueba local sintética'});
  assert.equal(created.status,201);const patientId=created.body.patient.id;
  const form=new FormData();form.append('file',new File(['%PDF-1.4\n%%EOF'],'analitica-ficticia.pdf',{type:'application/pdf'}));
  const upload=await request(admin,`/api/patients/${patientId}/documents`,{
    method:'POST',body:form,headers:{origin:'null','x-csrf-token':await token(admin)}
  });
  assert.equal(upload.status,201);const documentId=upload.body.document.id;
  const draft={patientName:name,name:'Analítica ficticia',eventDate:'2026-10-15',doctorName:'Dra. Ejemplo',centerName:'Centro Ejemplo',
    specialtyName:'Laboratorio',indication:null,findings:'Informe sintético',conclusion:null,
    measurements:[
      {typeName:'Glucosa',originalValue:'92 mg/dL',numericValue:'92',unit:'mg/dL',referenceRange:'70-100'},
      {typeName:'Marcador ficticio',originalValue:'no detectable',numericValue:null,unit:null,referenceRange:null}
    ],evidence:[]};
  const types=(await request(admin,'/api/measurement-types')).body.types,glucose=types.find(t=>t.name==='Glucosa');assert.ok(glucose);
  const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});
  try{
    const actor=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
    const insert=async value=>(await pool.query(`INSERT INTO extraction_runs(patient_id,document_id,kind,status,model,schema_version,draft,created_by)
      VALUES($1,$2,'examination','review','synthetic',1,$3,$4) RETURNING id`,[patientId,documentId,value,actor])).rows[0].id;
    const bad=await insert({...draft,patientName:'Otra persona'});
    const confirm=(runId,review=draft,selected=[glucose.id,null])=>post(admin,`/api/patients/${patientId}/extractions/${runId}/confirm`,
      {draft:review,measurementTypeIds:selected});
    assert.equal((await confirm(bad)).status,409);
    const good=await insert(draft);
    assert.equal((await confirm(good,draft,[glucose.id,glucose.id])).status,400);
    const first=await confirm(good);assert.equal(first.status,200);
    assert.equal(first.body.examination.alreadyConfirmed,false);
    const again=await confirm(good);assert.equal(again.status,200);
    assert.equal(again.body.examination.id,first.body.examination.id);
    assert.equal(again.body.examination.alreadyConfirmed,true);
    const exam=await pool.query('SELECT event_date::text,doctor_as_documented,findings FROM examinations WHERE id=$1',[first.body.examination.id]);
    assert.equal(exam.rows[0].event_date,'2026-10-15');assert.equal(exam.rows[0].doctor_as_documented,'Dra. Ejemplo');
    assert.match(exam.rows[0].findings,/Marcador ficticio: no detectable/);
    const measurements=await pool.query('SELECT numeric_value::text,original_value,document_id FROM measurements WHERE examination_id=$1',[first.body.examination.id]);
    assert.equal(measurements.rowCount,1);assert.equal(measurements.rows[0].numeric_value,'92');
    assert.equal(measurements.rows[0].original_value,'92 mg/dL');assert.equal(measurements.rows[0].document_id,documentId);
    const link=await pool.query('SELECT document_id FROM examination_documents WHERE examination_id=$1',[first.body.examination.id]);
    assert.equal(link.rows[0].document_id,documentId);
    const summary=await request(admin,`/patients/${patientId}`);
    assert.equal(summary.status,200);assert.match(summary.body,/Mediciones recientes/);
    assert.match(summary.body,/92 mg\/dL/);
    const patientEmail=`exam-${randomUUID().slice(0,8)}@example.test`;
    const invitation=await post(admin,`/api/patients/${patientId}/invitations`,{email:patientEmail});
    assert.equal(invitation.status,201);
    const inviteToken=invitation.body.invitationUrl.split('/').at(-1),patient=client();
    const invitePage=(await request(patient,'/invite/'+inviteToken)).body;
    const csrf=invitePage.match(/name="csrfToken" value="([^"]+)"/)?.[1];assert.ok(csrf);
    assert.equal((await request(patient,'/api/auth/accept-invite',{method:'POST',
      body:new URLSearchParams({token:inviteToken,password:'synthetic-exam-password-123',csrfToken:csrf}),headers:{origin:'null'}})).status,303);
    await login(patient,patientEmail,'synthetic-exam-password-123');
    const detailPath=`/patients/${patientId}/exams/${first.body.examination.id}`;
    const hidden=(await request(patient,detailPath)).body;
    assert.equal(typeof hidden,'string');assert.ok(!hidden.includes('analitica-ficticia.pdf'));
    assert.equal((await request(patient,`/api/patients/${patientId}/documents/${documentId}`)).status,404);
    const privateMeasures=(await request(patient,`/api/patients/${patientId}/measurements`)).body.measurements;assert.equal(privateMeasures[0].documentId,null);assert.equal(privateMeasures[0].typeId,glucose.id);
    const publish=await request(admin,`/api/patients/${patientId}/documents/${documentId}`,{
      method:'PATCH',body:JSON.stringify({visibleToPatient:true}),
      headers:{origin:'null','content-type':'application/json','x-csrf-token':await token(admin)}
    });
    assert.equal(publish.status,200);
    const shown=(await request(patient,detailPath)).body;
    assert.match(shown,/analitica-ficticia\.pdf/);
    assert.equal((await request(patient,`/api/patients/${patientId}/documents/${documentId}`)).status,200);
    assert.equal((await request(patient,`/api/patients/${patientId}/measurements`)).body.measurements[0].documentId,documentId);
    const change={version:1,name:'Analítica corregida',eventDate:'2026-10-15',indication:null,
      findings:'Hallazgo rectificado',conclusion:null,status:'published',changeReason:'Corrección del informe sintético'};
    const correction=await request(admin,`/api/patients/${patientId}/examinations/${first.body.examination.id}`,{
      method:'PATCH',body:JSON.stringify(change),headers:{origin:'null','content-type':'application/json','x-csrf-token':await token(admin)}
    });
    assert.equal(correction.status,200);assert.equal(correction.body.examination.version,2);
    const stale=await request(admin,`/api/patients/${patientId}/examinations/${first.body.examination.id}`,{
      method:'PATCH',body:JSON.stringify(change),headers:{origin:'null','content-type':'application/json','x-csrf-token':await token(admin)}
    });
    assert.equal(stale.status,409);
    const revision=await pool.query('SELECT previous_version,reason,snapshot FROM examination_revisions WHERE examination_id=$1',
      [first.body.examination.id]);
    assert.equal(revision.rowCount,1);assert.equal(revision.rows[0].previous_version,1);
    assert.equal(revision.rows[0].snapshot.name,'Analítica ficticia');
    assert.match((await request(patient,detailPath)).body,/Analítica corregida/);
    const unpublish=await request(admin,`/api/patients/${patientId}/examinations/${first.body.examination.id}`,{
      method:'PATCH',body:JSON.stringify({...change,version:2,status:'draft',changeReason:'Retirada de prueba'}),
      headers:{origin:'null','content-type':'application/json','x-csrf-token':await token(admin)}
    });
    assert.equal(unpublish.status,409);
  }finally{await pool.end()}
});

test('MFA del administrador: TOTP y recuperación de un solo uso', {skip:!enabled||!localDb}, async()=>{
  const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});
  const adminEmail=`mfa-${randomUUID().slice(0,8)}@example.test`,adminPassword='synthetic-mfa-password-12345';
  const salt=randomBytes(16).toString('hex'),hash=`scrypt:${salt}:${scryptSync(adminPassword,salt,64).toString('hex')}`;
  try{
    await pool.query("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin')",[adminEmail,hash]);
    const initial=client();await login(initial,adminEmail,adminPassword);
    const start=await post(initial,'/api/auth/mfa',{password:adminPassword});
    assert.equal(start.status,200);assert.equal(start.body.codes.length,8);
    const activate=await request(initial,'/api/auth/mfa',{method:'PATCH',headers:{origin:'null','content-type':'application/json','x-csrf-token':await token(initial)},body:JSON.stringify({code:totp(start.body.secret)})});
    assert.equal(activate.status,200);
    async function attempt(code){
      const actor=client(),html=(await request(actor,'/login')).body,csrf=html.match(/name="csrfToken" value="([^"]+)"/)?.[1];
      const form=new URLSearchParams({email:adminEmail,password:adminPassword,csrfToken:csrf,mfaCode:code});
      return request(actor,'/api/auth/login',{method:'POST',body:form,headers:{origin:'null'}});
    }
    const missing=await attempt('');assert.equal(missing.status,303);assert.match(missing.headers.get('location'),/error=invalid/);
    const mfa=await attempt(totp(start.body.secret));assert.equal(mfa.status,303);assert.ok(mfa.headers.get('set-cookie')?.includes('vitala='));
    const recovery=await attempt(start.body.codes[0]);assert.equal(recovery.status,303);assert.ok(recovery.headers.get('set-cookie')?.includes('vitala='));
    const repeated=await attempt(start.body.codes[0]);assert.equal(repeated.status,303);assert.match(repeated.headers.get('location'),/error=invalid/);
  }finally{await pool.end()}
});

test('recuperación del paciente: enlace de un uso y revocación de sesiones', {skip:!enabled||!localDb}, async()=>{
  const admin=client();await login(admin,email,password);
  const suffix=randomUUID().slice(0,8),patientEmail=`reset-${suffix}@example.test`;
  const created=await post(admin,'/api/patients',{name:'Recuperación ficticia '+suffix,authorizedBy:'Paciente ficticio',basis:'Prueba local sintética'});
  assert.equal(created.status,201);const id=created.body.patient.id;
  const invite=await post(admin,`/api/patients/${id}/invitations`,{email:patientEmail});assert.equal(invite.status,201);
  const inviteToken=invite.body.invitationUrl.split('/').at(-1),patient=client();
  const html=(await request(patient,'/invite/'+inviteToken)).body,csrf=html.match(/name="csrfToken" value="([^"]+)"/)?.[1];
  assert.equal((await request(patient,'/api/auth/accept-invite',{method:'POST',body:new URLSearchParams({token:inviteToken,password:'synthetic-old-password-123',csrfToken:csrf}),headers:{origin:'null'}})).status,303);
  await login(patient,patientEmail,'synthetic-old-password-123');
  const recovery=await post(admin,`/api/patients/${id}/password-reset`,{password});assert.equal(recovery.status,200);
  const resetToken=recovery.body.resetUrl.split('/').at(-1),resetHtml=(await request(client(),'/reset/'+resetToken)).body;
  const resetCsrf=resetHtml.match(/name="csrfToken" value="([^"]+)"/)?.[1];assert.ok(resetCsrf);
  const resetForm=new URLSearchParams({token:resetToken,password:'synthetic-new-password-123',repeatPassword:'synthetic-new-password-123',csrfToken:resetCsrf});
  const changed=await request(client(),'/api/auth/reset-password',{method:'POST',body:resetForm,headers:{origin:'null'}});
  assert.equal(changed.status,303);assert.match(changed.headers.get('location'),/reset=1/);
  assert.equal((await request(patient,`/api/patients/${id}`)).status,401);
  const reused=await request(client(),'/api/auth/reset-password',{method:'POST',body:resetForm,headers:{origin:'null'}});
  assert.equal(reused.status,303);assert.match(reused.headers.get('location'),/error=reset/);
  await login(client(),patientEmail,'synthetic-new-password-123');
});

test('condiciones: catálogo, alta, edición persistida, concurrencia y aislamiento', {skip:!enabled||!localDb}, async()=>{
 const admin=client();await login(admin,email,password);
 const create=async name=>(await post(admin,'/api/patients',{name,authorizedBy:'Ficticio',basis:'Prueba local'})).body.patient.id;
 const patientId=await create('Paciente condiciones '+randomUUID()),other=await create('Paciente ajeno '+randomUUID());
 const catalog=await post(admin,'/api/catalogs/conditions',{name:'Condición de prueba '+randomUUID()});assert.equal(catalog.status,201);
 const root=`/api/patients/${patientId}/conditions`;
 const created=await post(admin,root,{conditionId:catalog.body.item.id,certainty:'suspected',state:'unknown',note:'Nota inicial'});assert.equal(created.status,201);
 let item=(await request(admin,root)).body.conditions.find(x=>x.id===created.body.condition.id);assert.equal(item.conditionId,catalog.body.item.id);assert.equal(item.version,1);
 const edit={id:item.id,version:1,state:'active',certainty:'confirmed',note:'Nota revisada',changeReason:'Corrección de prueba'};
 const patch=async(path,data)=>request(admin,path,{method:'PATCH',body:JSON.stringify(data),headers:{origin:'null','content-type':'application/json','x-csrf-token':await token(admin)}});
 assert.equal((await patch(`/api/patients/${other}/conditions`,edit)).status,404);
 assert.equal((await patch(root,edit)).status,200);
 assert.equal((await patch(root,edit)).status,409);
 item=(await request(admin,root)).body.conditions.find(x=>x.id===edit.id);assert.equal(item.note,'Nota revisada');assert.equal(item.state,'active');assert.equal(item.version,2);
 const page=await request(admin,`/patients/${patientId}/conditions`);assert.equal(page.status,200);assert.match(page.body,/Secciones del paciente/);assert.match(page.body,/Condiciones y alergias/);
 const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});try{const rev=(await pool.query('SELECT snapshot FROM clinical_fact_revisions WHERE resource_id=$1',[item.id])).rows;assert.equal(rev.length,1);assert.equal(rev[0].snapshot.note,'Nota inicial')}finally{await pool.end()}
});

test('IA: corregir datos, confirmar cada discrepancia y conservar original y auditoría', {skip:!enabled||!localDb}, async()=>{
 const admin=client();await login(admin,email,password);
 const patientId=(await post(admin,'/api/patients',{name:'Teresa Ramirez',birthDate:'1949-09-25',authorizedBy:'Ficticio',basis:'Prueba local'})).body.patient.id;
 const form=new FormData();form.append('file',new File(['%PDF-1.4\n%%EOF'],'identidad-ficticia.pdf',{type:'application/pdf'}));
 const upload=await request(admin,`/api/patients/${patientId}/documents`,{method:'POST',body:form,headers:{origin:'null','x-csrf-token':await token(admin)}});assert.equal(upload.status,201);
 const documentId=upload.body.document.id;
 const original={patientName:'Teresa de Cabañales Ramirez',patientBirthDate:'1950-01-01',patientIdentifier:'FICTICIO-123',eventDate:null,doctorName:null,centerName:null,specialtyName:null,reason:null,symptoms:null,summary:'Texto detectado',findings:null,impression:null,conclusion:null,recommendations:null,followUp:null,evidence:[]};
 const corrected={...original,patientName:'Teresa Ramirez',summary:'Texto corregido por quien revisa',conclusion:'Conclusión revisada'};
 const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});
 try{
  const actor=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
  const runId=(await pool.query("INSERT INTO extraction_runs(patient_id,document_id,kind,status,model,schema_version,draft,original_draft,created_by) VALUES($1,$2,'consultation','review','synthetic',1,$3,$3,$4) RETURNING id",[patientId,documentId,original,actor])).rows[0].id;
  const url=`/api/patients/${patientId}/extractions/${runId}/confirm`;
  assert.equal((await post(admin,url,{draft:corrected})).status,409);
  assert.equal((await post(admin,url,{draft:corrected,identityAcknowledgements:['name'],identityReason:'Variante del nombre verificada'})).status,409);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM consultations WHERE patient_id=$1',[patientId])).rows[0].n,0);
  const body={draft:corrected,identityAcknowledgements:['name','birthDate','identifier'],identityReason:'Datos ficticios: diferencias revisadas contra el documento de prueba'};
  const saved=await post(admin,url,body);assert.equal(saved.status,200);
  const again=await post(admin,url,body);assert.equal(again.body.consultation.id,saved.body.consultation.id);
  const run=(await pool.query('SELECT original_draft,draft,identity_review FROM extraction_runs WHERE id=$1',[runId])).rows[0];
  assert.equal(run.original_draft.patientName,original.patientName);assert.equal(run.draft.summary,corrected.summary);assert.equal(run.identity_review.issues.length,3);
  const stored=(await pool.query('SELECT summary,conclusion FROM consultations WHERE id=$1',[saved.body.consultation.id])).rows[0];assert.deepEqual(stored,{summary:corrected.summary,conclusion:corrected.conclusion});
  assert.equal((await pool.query('SELECT document_id FROM consultation_documents WHERE consultation_id=$1',[saved.body.consultation.id])).rows[0].document_id,documentId);
  const audit=await pool.query("SELECT 1 FROM audit_events WHERE resource_id=$1 AND action='confirm_document_identity'",[runId]);assert.equal(audit.rowCount,1);
 }finally{await pool.end()}
});

test('entrada por rol, perfil propio, upload del paciente, invitación y sesión revocada', {skip:!enabled||!localDb}, async()=>{
 const admin=client(),adminLogin=await login(admin,email,password);assert.equal(new URL(adminLogin.headers.get('location')).pathname,'/patients');
 const suffix=randomUUID().slice(0,8),patientEmail=`portal-${suffix}@example.test`,patientPassword='Synthetic-portal-password-2026';
 const created=await post(admin,'/api/patients',{name:'Paciente portal '+suffix,authorizedBy:'Prueba',basis:'Datos ficticios'}),id=created.body.patient.id;
 const other=(await post(admin,'/api/patients',{name:'Otro portal '+suffix,authorizedBy:'Prueba',basis:'Datos ficticios'})).body.patient.id;
 const first=await post(admin,`/api/patients/${id}/invitations`,{email:patientEmail});assert.equal(first.body.delivery,'manual');
 const second=await post(admin,`/api/patients/${id}/invitations`,{email:patientEmail});
 const activate=async url=>{const actor=client(),tokenValue=url.split('/').at(-1),html=(await request(actor,'/invite/'+tokenValue)).body,csrf=html.match(/name="csrfToken" value="([^"]+)"/)?.[1];return request(actor,'/api/auth/accept-invite',{method:'POST',body:new URLSearchParams({token:tokenValue,password:patientPassword,csrfToken:csrf}),headers:{origin:'null'}})};
 assert.equal((await activate(first.body.invitationUrl)).status,400);assert.equal((await activate(second.body.invitationUrl)).status,303);
 assert.ok((await request(admin,`/api/patients/${id}/invitations`)).body.account);
 const patient=client(),signed=await login(patient,patientEmail,patientPassword);assert.equal(new URL(signed.headers.get('location')).pathname,`/patients/${id}`);
 assert.equal((await request(patient,'/api/patients')).status,403);
 assert.equal((await request(patient,'/patients')).headers.get('location'),`/patients/${id}`);
 for(let i=0;i<2;i++){const home=await request(patient,`/patients/${id}`);assert.equal(home.status,200);assert.ok(!home.body.includes('Directorio médico'));assert.ok(!home.body.includes('href="/patients"'));assert.ok(home.body.includes('Mi salud'));}
 const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});let userId;
 try{userId=(await pool.query('SELECT id FROM users WHERE email=$1',[patientEmail])).rows[0].id;
 await pool.query("INSERT INTO patient_access_grants(patient_id,user_id,access_level,authorized_by,basis,created_by) SELECT $1,$2,'read','Prueba','Concesión errónea simulada',id FROM users WHERE email=$3",[other,userId,email]);
 }finally{await pool.end()}
 assert.equal((await request(patient,`/api/patients/${other}`)).status,404);assert.equal((await request(patient,`/patients/${other}`)).status,404);
 const upload=async target=>{const form=new FormData();form.append('file',new File([`%PDF-1.4\n% ${suffix}\n%%EOF`],'informe-paciente.pdf',{type:'application/pdf'}));return request(patient,`/api/patients/${target}/documents`,{method:'POST',body:form,headers:{origin:'null','x-csrf-token':await token(patient)}})};
 assert.equal((await upload(other)).status,404);const document=await upload(id);assert.equal(document.status,201);const docId=document.body.document.id;
 assert.equal((await upload(id)).status,409);assert.equal((await request(patient,`/api/patients/${id}/documents/${docId}`)).status,200);
 assert.equal((await request(patient,`/api/patients/${id}/documents`)).body.documents[0].processingStatus,'uploaded');
 const remove=async(target,doc)=>request(patient,`/api/patients/${target}/documents/${doc}`,{method:'DELETE',headers:{origin:'null','x-csrf-token':await token(patient)}});
 assert.equal((await remove(other,docId)).status,404);
 assert.equal((await remove(id,docId)).status,200);
 assert.equal((await request(patient,`/api/patients/${id}/documents`)).body.documents.length,0);
 assert.equal((await post(patient,`/api/patients/${id}/documents/${docId}`,{})).status,200);
 assert.equal((await request(patient,`/api/patients/${id}/documents`)).body.documents.length,1);
 assert.equal((await remove(id,docId)).status,200);
 const reuploaded=await upload(id);assert.equal(reuploaded.status,201);assert.notEqual(reuploaded.body.document.id,docId);
 assert.equal((await post(patient,`/api/patients/${id}/documents/${docId}`,{})).status,409);

 assert.equal((await post(patient,`/api/patients/${id}/documents/${docId}/analyze`,{kind:'consultation'})).status,404);
 assert.equal((await request(admin,`/reviews?patient=${id}`)).status,200);
 assert.equal((await request(patient,'/reviews')).status,307);
 const logout=await request(patient,'/api/auth/logout',{method:'POST',body:new URLSearchParams({csrfToken:await token(patient)}),headers:{origin:'null'}});assert.equal(logout.status,303);
 assert.equal(new URL((await login(patient,patientEmail,patientPassword)).headers.get('location')).pathname,`/patients/${id}`);
 const csrf=await token(admin);assert.equal((await request(admin,`/api/patients/${id}/grants`,{method:'PATCH',headers:{origin:'null','content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({userId})})).status,200);
 assert.equal((await request(patient,`/api/patients/${id}`)).status,401);
 assert.equal(new URL((await login(patient,patientEmail,patientPassword)).headers.get('location')).pathname,'/access-unavailable');
 assert.ok((await request(patient,'/access-unavailable')).body.includes('Tu perfil aún no está disponible'));
});

test('edición y archivo conservan revisiones y relaciones; revisión IA guarda correcciones', {skip:!enabled||!localDb}, async()=>{
 const admin=client();await login(admin,email,password);const suffix=randomUUID().slice(0,8);
 const patch=async(path,data)=>request(admin,path,{method:'PATCH',headers:{origin:'null','content-type':'application/json','x-csrf-token':await token(admin)},body:JSON.stringify(data)});
 const patient=(await post(admin,'/api/patients',{name:'Flujos '+suffix,authorizedBy:'Prueba',basis:'Sintético'})).body.patient.id;
 const center=await post(admin,'/api/catalogs/centers',{name:'Centro '+suffix,city:'Ciudad A'});assert.equal(center.status,201);
 assert.equal((await post(admin,'/api/catalogs/centers',{name:('Centro '+suffix).toUpperCase()})).status,409);
 assert.equal((await patch('/api/catalogs/centers',{id:center.body.item.id,city:'Ciudad B'})).status,200);
 assert.equal((await request(admin,'/api/catalogs/centers')).body.items.find(i=>i.id===center.body.item.id).city,'Ciudad B');
 const med=(await post(admin,'/api/catalogs/medications',{name:'Medicación '+suffix})).body.item;
 const use=(await post(admin,`/api/patients/${patient}/medications`,{medicationId:med.id,dose:'Original',state:'active'})).body.medication;
 assert.equal((await patch(`/api/patients/${patient}/medications`,{id:use.id,version:1,dose:'Corregida',changeReason:'Corrección sintética'})).status,200);
 assert.equal((await patch(`/api/patients/${patient}/medications`,{id:use.id,version:1,dose:'Obsoleta',changeReason:'Prueba conflicto'})).status,409);
 const m=(await request(admin,`/api/patients/${patient}/medications`)).body.medications[0];assert.equal(m.dose,'Corregida');assert.equal(m.version,2);
 assert.equal((await patch(`/api/patients/${patient}/medications`,{id:use.id,version:2,status:'void',changeReason:'Registro de prueba archivado'})).status,200);
 assert.equal((await request(admin,`/api/patients/${patient}/medications`)).body.medications.length,0);
 const type=(await request(admin,'/api/measurement-types')).body.types.find(t=>t.name==='Peso');
 const measure=(await post(admin,`/api/patients/${patient}/measurements`,{typeId:type.id,valueKind:'number',originalValue:'60 kg',numericValue:'60',unit:'kg'})).body.measurement;
 assert.equal((await patch(`/api/patients/${patient}/measurements`,{id:measure.id,version:1,numericValue:'61',originalValue:'61 kg',changeReason:'Corregir transcripción'})).status,200);
 assert.equal((await patch('/api/measurement-types',{id:type.id,valueKind:'text'})).status,409);
 assert.equal((await patch(`/api/patients/${patient}/measurements`,{id:measure.id,version:2,status:'void',changeReason:'Archivo sintético'})).status,200);
 const form=new FormData();form.append('file',new File([`%PDF-1.4\n% draft ${suffix}\n%%EOF`],'revision.pdf',{type:'application/pdf'}));
 const upload=await request(admin,`/api/patients/${patient}/documents`,{method:'POST',body:form,headers:{origin:'null','x-csrf-token':await token(admin)}});assert.equal(upload.status,201);const documentId=upload.body.document.id;
 const draft={patientName:null,eventDate:null,doctorName:null,centerName:null,specialtyName:null,reason:null,symptoms:null,summary:'Original',findings:null,impression:null,conclusion:null,recommendations:null,followUp:null,evidence:[]};
 const pool=new pg.Pool({connectionString:process.env.SMOKE_DATABASE_URL,max:1});try{
 const actor=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
 const run=(await pool.query("INSERT INTO extraction_runs(patient_id,document_id,kind,status,model,schema_version,draft,original_draft,created_by) VALUES($1,$2,'consultation','review','synthetic',1,$3,$3,$4) RETURNING id",[patient,documentId,draft,actor])).rows[0].id;
 const endpoint=`/api/patients/${patient}/documents/${documentId}/analyze`;
 const saved=await patch(endpoint,{runId:run,reviewVersion:1,draft:{...draft,summary:'Corrección guardada'}});assert.equal(saved.status,200);assert.equal(saved.body.reviewVersion,2);
 assert.equal((await patch(endpoint,{runId:run,reviewVersion:1,draft})).status,409);
 const loaded=(await request(admin,endpoint)).body.runs[0];assert.equal(loaded.draft.summary,'Corrección guardada');assert.equal(loaded.originalDraft.summary,'Original');
 assert.equal((await post(admin,`/api/patients/${patient}/extractions/${run}/confirm`,{reviewVersion:1,draft})).status,409);
 const confirmed=await post(admin,`/api/patients/${patient}/extractions/${run}/confirm`,{reviewVersion:2,draft:loaded.draft});assert.equal(confirmed.status,200);
 const again=await post(admin,`/api/patients/${patient}/extractions/${run}/confirm`,{reviewVersion:2,draft:loaded.draft});assert.equal(again.body.consultation.id,confirmed.body.consultation.id);
 assert.equal((await request(admin,`/api/patients/${patient}/documents`)).body.documents[0].processingStatus,'confirmed');
 assert.equal((await patch(`/api/patients/${patient}/consultations/${confirmed.body.consultation.id}`,{version:1,status:'void',changeReason:'Archivo de prueba'})).status,200);
 assert.ok((await pool.query('SELECT count(*)::int AS n FROM clinical_fact_revisions WHERE patient_id=$1',[patient])).rows[0].n>=4);
 }finally{await pool.end()}
});

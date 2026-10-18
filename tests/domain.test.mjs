import test from 'node:test';
import assert from 'node:assert/strict';
import {patientCreate,treatmentInput} from '../app/lib/schemas.ts';
import {extractedConsultation,extractedExamination,analyzeMedicalDocument,identityMismatch} from '../app/lib/extraction.ts';
import {types} from 'pg';
import {ageYears} from '../app/lib/labels.ts';
import '../app/lib/db.ts';
import {base32Encode,totp,validTotp,encryptMfaSecret,decryptMfaSecret,newRecoveryCode,recoveryCodeHash} from '../app/lib/mfa.ts';

test('un paciente necesita fundamento de incorporación',()=>{
  assert.equal(patientCreate.safeParse({name:'Paciente',authorizedBy:'Paciente'}).success,false);
  assert.equal(patientCreate.safeParse({name:'Paciente',authorizedBy:'Paciente',basis:'Seguimiento autorizado'}).success,true);
});
test('un tratamiento no inventa vigencia y valida el orden de fechas',()=>{
  const base={requestKey:'11111111-1111-4111-8111-111111111111',name:'Plan documentado'};
  assert.equal(treatmentInput.parse(base).state,'unknown');
  assert.equal(treatmentInput.safeParse({...base,startDate:'2026-10-20',endDate:'2026-10-19'}).success,false);
});
test('la extracción acepta faltantes y rechaza campos inesperados',()=>{
  const draft={patientName:null,eventDate:null,doctorName:null,centerName:null,specialtyName:null,reason:null,symptoms:null,
    summary:null,findings:null,impression:null,conclusion:null,recommendations:null,followUp:null,evidence:[]};
  assert.equal(extractedConsultation.safeParse(draft).success,true);
  assert.equal(extractedConsultation.safeParse({...draft,diagnosisFromModel:'inventado'}).success,false);
});
test('el esquema de examen conserva valores no numéricos y rechaza resultados vacíos',()=>{
  const draft={patientName:null,name:'Analítica',eventDate:null,doctorName:null,centerName:null,specialtyName:null,
    indication:null,findings:null,conclusion:null,measurements:[
      {typeName:'Prueba cualitativa',originalValue:'No detectable',numericValue:null,unit:null,referenceRange:null}
    ],evidence:[]};
  assert.equal(extractedExamination.safeParse(draft).success,true);
  assert.equal(extractedExamination.safeParse({...draft,measurements:[{...draft.measurements[0],originalValue:''}]}).success,false);
  assert.equal(extractedExamination.safeParse({...draft,measurements:[{...draft.measurements[0],numericValue:'<70'}]}).success,false);
});
test('contrato de OpenAI: sin almacenamiento de respuesta y errores controlados',async()=>{
  const previousKey=process.env.OPENAI_API_KEY,previousFetch=globalThis.fetch;
  process.env.OPENAI_API_KEY='synthetic-test-key';
  const draft={patientName:null,name:'Informe ficticio',eventDate:null,doctorName:null,centerName:null,specialtyName:null,
    indication:null,findings:null,conclusion:null,measurements:[],evidence:[]};
  const args={key:'synthetic',mime:'application/pdf',name:'ficticio.pdf',bytes:new Uint8Array([37,80,68,70]),model:'synthetic-model',kind:'examination'};
  try{
    globalThis.fetch=async (url,options)=>{
      assert.equal(url,'https://api.openai.com/v1/responses');
      const body=JSON.parse(options.body);
      assert.equal(body.store,false);assert.equal(body.model,'synthetic-model');
      assert.equal(body.text.format.name,'vitala_examination_v1');
      assert.equal(body.input[0].content[0].type,'input_file');
      assert.equal(body.tools,undefined);
      return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(draft)}]}],usage:{input_tokens:12,output_tokens:8}}),{status:200});
    };
    const extracted=await analyzeMedicalDocument(args);
    assert.deepEqual(extracted.draft,draft);assert.equal(extracted.usage.input_tokens,12);
    for(const [status,code,expected] of [[401,null,'AI_AUTH'],[403,null,'AI_ACCESS'],[404,null,'AI_MODEL'],[400,null,'AI_REQUEST'],[429,'insufficient_quota','AI_QUOTA']]){globalThis.fetch=async()=>new Response(JSON.stringify({error:{code}}),{status});await assert.rejects(analyzeMedicalDocument(args),new RegExp(expected));}
    globalThis.fetch=async()=>new Response('{}',{status:429});
    await assert.rejects(analyzeMedicalDocument(args),/AI_RATE/);
    globalThis.fetch=async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'{'}]}]}),{status:200});
    await assert.rejects(analyzeMedicalDocument(args),/AI_INVALID/);
  }finally{
    globalThis.fetch=previousFetch;
    if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;
  }
});
test('una discrepancia de paciente bloquea la confirmación',()=>{
  assert.equal(identityMismatch('Maria Núñez','María Núñez'),false);
  assert.equal(identityMismatch('Otra Persona','María Núñez'),true);
  assert.equal(identityMismatch(null,'María Núñez'),false);
});
test('PostgreSQL DATE conserva el día sin conversión de zona horaria',()=>{
  assert.equal(types.getTypeParser(1082,'text')('2026-10-15'),'2026-10-15');
});
test('la edad cambia solo en el cumpleaños y no inventa fechas ausentes',()=>{
  assert.equal(ageYears('2000-10-19','2026-10-18'),25);
  assert.equal(ageYears('2000-10-19','2026-10-19'),26);
  assert.equal(ageYears(null,'2026-10-19'),null);
  assert.equal(ageYears('2026-10-20','2026-10-19'),null);
});
test('verificación TOTP y códigos de recuperación',()=>{
  const secret=base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(totp(secret,59_000),'287082');
  assert.equal(validTotp(secret,'287082',59_000),true);
  assert.equal(validTotp(secret,'287083',59_000),false);
  const code=newRecoveryCode();
  assert.equal(recoveryCodeHash(code),recoveryCodeHash(code.replaceAll('-','').toLowerCase()));
  const encrypted=encryptMfaSecret(secret,'synthetic-master-secret-123456789012345');
  assert.equal(decryptMfaSecret(encrypted,'synthetic-master-secret-123456789012345'),secret);
});

test('las diferencias de identidad se revisan por separado y no se infieren coincidencias',async()=>{
 const {identityIssues}=await import('../app/lib/document-identity.ts');
 assert.deepEqual(identityIssues({patientName:'Teresa Ramírez'},{name:'Teresa Ramirez'}),[]);
 const issues=identityIssues({patientName:'Teresa de Cabañales Ramirez',patientBirthDate:'1950-01-01',patientIdentifier:'FICTICIO-123'},{name:'Teresa Ramirez',birthDate:'1949-09-25'});
 assert.deepEqual(issues.map(i=>i.field),['name','birthDate','identifier']);
 assert.equal(issues[1].patientValue,'1949-09-25');
});

test('las tendencias separan tipos, unidades y muestras y excluyen datos no comparables',async()=>{
 const {measurementGroups,trendPoints}=await import('../app/lib/measurement-series.ts');
 const base={id:'a',typeId:'glucose',typeName:'Glucosa',documentedDate:'2026-10-01',valueKind:'number',numericValue:'0',originalValue:'0',unit:'mg/dL',referenceRange:null,examinationId:null,status:'published'};
 const rows=[base,{...base,id:'b',documentedDate:'2026-10-15',numericValue:'92'}, {...base,id:'unit',unit:'mmol/L'}, {...base,id:'sample',sample:'Plasma en ayunas'}, {...base,id:'type',typeId:'different'}];
 const grouped=measurementGroups(rows);assert.equal(grouped.length,4);assert.equal(grouped[0].records.length,2);
 const points=trendPoints([...grouped[0].records,{...base,id:'draft',status:'draft'},{...base,id:'interval',valueKind:'interval'},{...base,id:'missing-unit',unit:null},{...base,id:'missing-date',documentedDate:null},{...base,id:'invalid',numericValue:'NaN'},{...base,id:'invalid-date',documentedDate:'not-a-date'}]);
 assert.deepEqual(points.map(p=>p.id),['a','b']);assert.equal(points[0].numericValue,'0');
});

test('los análisis distintos no se mezclan aunque compartan tipo de catálogo',async()=>{
 const {measurementGroups}=await import('../app/lib/measurement-series.ts');
 const base={id:'a',typeId:'blood',typeName:'Colesterol',documentedDate:'2026-10-06',valueKind:'number',numericValue:'148',originalValue:'148',unit:'mg/dl',referenceRange:'60 - 200',examinationId:'e',status:'published'};
 const groups=measurementGroups([base,{...base,id:'b',typeName:'Triglicéridos',numericValue:'58'}]);
 assert.equal(groups.length,2);assert.deepEqual(groups.map(g=>g.name),['Colesterol','Triglicéridos']);
});
test('la explicación IA usa valores sin identidad y queda invalidada al corregir resultados',async()=>{
 const {examinationFingerprint,interpretExamination}=await import('../app/lib/examination-interpretation.ts');
 const exam={id:'e',version:1,name:'Química sanguínea',status:'published',patient_name:'NO ENVIAR',patient_id:'NO ENVIAR'};
 const measurements=[{id:'a',version:1,type_name:'Sanguínea',name_as_documented:'Colesterol',original_value:'148',numeric_value:'148',unit:'mg/dl',reference_range:'60 - 200',status:'published'}];
 const hash=examinationFingerprint(exam,measurements);
 assert.notEqual(hash,examinationFingerprint(exam,[{...measurements[0],version:2,original_value:'149'}]));
 assert.notEqual(hash,examinationFingerprint(exam,[{...measurements[0],name_as_documented:'HDL'}]));
 assert.notEqual(hash,examinationFingerprint(exam,[]));
 const oldFetch=globalThis.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='synthetic-only';
 try{globalThis.fetch=async(url,options)=>{
  const request=JSON.parse(options.body);assert.equal(request.store,false);assert.ok(!request.input.includes('NO ENVIAR'));assert.ok(request.input.includes('Colesterol'));assert.match(request.instructions,/No diagnostiques/);
  return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({findings:'Observación sintética',conclusion:'Resumen sintético',guidance:'Orientación sintética'})}]}]}),{status:200});
 };
 assert.equal((await interpretExamination(exam,measurements,'synthetic-model')).findings,'Observación sintética');
 globalThis.fetch=async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'{"diagnosis":"inventado"}'}]}]}),{status:200});
 await assert.rejects(()=>interpretExamination(exam,measurements,'synthetic-model'),/AI_INVALID/);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey}
});

test('la lectura completa acepta datos de otros módulos desde consulta o examen',async()=>{
 const record={kind:'allergy',name:'Sustancia ficticia',detail:null,phase:'historical',certainty:'confirmed',originalValue:null,numericValue:null,unit:null,referenceRange:null,dose:null,frequency:null,route:null,evidence:'Alergia a sustancia ficticia',page:'1'};
 const c={patientName:null,eventDate:null,doctorName:null,centerName:null,specialtyName:null,reason:null,symptoms:null,summary:null,findings:null,impression:null,conclusion:null,recommendations:null,followUp:null,evidence:[],clinicalRecords:[record]};
 assert.equal(extractedConsultation.safeParse(c).success,true);
 const e={patientName:null,name:'Examen',eventDate:null,doctorName:null,centerName:null,specialtyName:null,indication:null,findings:null,conclusion:null,measurements:[],evidence:[],clinicalRecords:[record]};
 assert.equal(extractedExamination.safeParse(e).success,true);
 assert.equal(extractedConsultation.safeParse({...c,clinicalRecords:[{...record,evidence:''}]}).success,false);
 assert.equal(extractedExamination.safeParse({...e,clinicalRecords:[{...record,kind:'measurement',originalValue:null}]}).success,false);
});

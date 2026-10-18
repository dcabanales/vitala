import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantEntries,validateAssistantAnswer,askPatientAssistant} from '../app/lib/patient-assistant.ts';
const source={consultations:[{summary:'Consulta ficticia de seguimiento.'}]};
test('asistente verifica citas y rechaza referencias inventadas',()=>{
 const entries=assistantEntries(source);
 const value=validateAssistantAnswer(JSON.stringify({answer:'Explicación de ejemplo',sources:[{ref:'consultations-0',quote:'Consulta ficticia'}]}),entries);
 assert.equal(value.sources.length,1);
 for(const citation of [{ref:'consultations-1',quote:'Consulta ficticia'},{ref:'consultations-0',quote:'Diagnóstico inventado'}])assert.throws(()=>validateAssistantAnswer(JSON.stringify({answer:'Respuesta',sources:[citation]}),entries));
});
test('asistente usa Responses sin herramientas ni persistencia y valida el resultado',async()=>{
 const previous=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'Explicación general de ejemplo.',sources:[]})}]}]})};
 try{
 const answer=await askPatientAssistant('¿Qué significa seguimiento?',source);
 assert.match(answer.answer,/general/);assert.equal(sent.store,false);assert.equal(sent.tools,undefined);assert.match(sent.input,/Consulta ficticia/);
 await assert.rejects(askPatientAssistant('Pregunta',{history:[{detail:'x'.repeat(180001)}]}),/SUMMARY_SIZE/);
 }finally{globalThis.fetch=previous}
});

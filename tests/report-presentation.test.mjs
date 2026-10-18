import test from 'node:test';
import assert from 'node:assert/strict';
import {reportText,studyKey,measurementWarning,resultCategory} from '../app/lib/report-presentation.ts';
test('reporte breve conserva frases completas y elimina referencias internas',()=>{
 assert.equal(reportText('Primera frase. Segunda frase. Tercera frase.'),'Primera frase. Segunda frase.');
 assert.equal(reportText('Primera frase. Segunda frase. Tercera frase.',true),'Primera frase. Segunda frase. Tercera frase.');
 assert.doesNotMatch(reportText('Hallazgo.\nFuente: abc\nCita: original\nVigencia no documentada'),/Fuente|Cita|Vigencia/);
});
test('agrupación de reporte conserva fechas y fuentes distintas',()=>{
 const base={id:'a',event_date:'2026-10-01',documents:[{id:'doc',withdrawn:false}]};
 assert.equal(studyKey(base),studyKey({...base,id:'b'}));
 assert.notEqual(studyKey(base),studyKey({...base,event_date:'2026-10-02'}));
 assert.notEqual(studyKey(base),studyKey({...base,documents:[{id:'other',withdrawn:false}]}));
});
test('avisos de calidad no corrigen valores y categorías distinguen muestras explícitas',()=>{
 assert.ok(measurementWarning('Peso','0.68','kg'));
 assert.ok(measurementWarning('Talla','1.51','cm'));
 assert.equal(measurementWarning('Peso','68','kg'),null);
 assert.equal(measurementWarning('Talla','1.51','m'),null);
 assert.equal(resultCategory('Leucocitos en orina'),'Orina');
 assert.equal(resultCategory('Leucocitos en heces'),'Heces');
});

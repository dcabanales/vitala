import test from 'node:test';
import assert from 'node:assert/strict';
import {similarFactNames,groupSimilarFacts} from '../app/lib/similar-facts.ts';
test('agrupa candidatos de escritura y abreviaturas documentadas sin mezclar contextos',()=>{
 assert.ok(similarFactNames('Hipertensión arterial','hipertension  arterial'));
 assert.ok(similarFactNames('Alergia a penicilina','Penicilina'));
 assert.ok(similarFactNames('Hipertensión arterial (HTA)','HTA'));
 assert.ok(similarFactNames('Colecistectomia','Colecistectomía'));
 assert.ok(similarFactNames('Hipertension arterial','Hipertension arteral'));
 assert.equal(similarFactNames('Diabetes tipo 1','Diabetes tipo 2'),false);
 assert.equal(similarFactNames('Sin hipertension','Hipertension'),false);
 assert.equal(similarFactNames('Sin hipertensión (HTA)','HTA'),false);
 assert.equal(similarFactNames('Cirugía rodilla izquierda','Cirugía rodilla derecha'),false);
 const rows=[{name:'Hipertensión arterial',kind:'personal',date:'2020'},{name:'hipertension arterial',kind:'personal',date:'2026'},{name:'Hipertensión arterial',kind:'family',date:'2020'}];
 const groups=groupSimilarFacts(rows,x=>x.name,x=>x.kind);assert.equal(groups.length,2);assert.deepEqual(groups[0].items,rows.slice(0,2));assert.deepEqual(groups[1].items,[rows[2]]);
});

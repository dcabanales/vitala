import test from 'node:test';
import assert from 'node:assert/strict';
import {groupRecords} from '../app/lib/group-records.ts';
test('agrupa nombres sin perder fechas, estados ni registros diferentes',()=>{
 const rows=[{name:' Plan A ',date:'2020-01-01',state:'completed'},{name:'plan a',date:'2026-01-01',state:'active'},{name:'Plan B',date:null,state:'unknown'}];
 const groups=groupRecords(rows,r=>r.name);assert.equal(groups.length,2);assert.deepEqual(groups[0].items,rows.slice(0,2));assert.deepEqual(groups[1].items,[rows[2]]);assert.equal(rows.length,3);
});

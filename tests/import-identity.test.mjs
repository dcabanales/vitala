import test from 'node:test';
import assert from 'node:assert/strict';
import {clinicalIdentity,clinicalImportKey,measurementIdentity} from '../app/lib/import-identity.ts';
test('identidad clínica conserva valores distintos y tolera diferencias de cita y espacios',()=>{
 const r={kind:'measurement',name:' Glucosa ',phase:'unknown',originalValue:'92 mg/dL',numericValue:'92',unit:'mg/dL',referenceRange:'70-100'};
 assert.equal(clinicalIdentity(r),clinicalIdentity({...r,name:'glucosa',evidence:'Otra cita'}));
 assert.notEqual(clinicalImportKey(r),clinicalImportKey({...r,originalValue:'105 mg/dL',numericValue:'105'}));
 assert.equal(measurementIdentity(r),measurementIdentity({typeName:'glucosa',originalValue:'92 mg/dL',numericValue:'92',unit:'mg/dL',referenceRange:'70-100'}));
});

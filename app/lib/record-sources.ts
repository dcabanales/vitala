// SQL fragments use only internal aliases and the closed record-kind union.
type Kind='condition'|'allergy'|'history'|'treatment'|'medication'|'consultation'|'examination'|'measurement';
export function recordSourceIds(alias:string,kind:Kind){
 const parts=[`SELECT i.document_id FROM consultation_import_records i WHERE i.patient_id=${alias}.patient_id AND i.kind='${kind}' AND i.resource_id=${alias}.id`];
 if(['condition','allergy','history','medication','measurement'].includes(kind))parts.push(`SELECT ${alias}.document_id AS document_id WHERE ${alias}.document_id IS NOT NULL`);
 if(kind==='consultation')parts.push(`SELECT v.document_id FROM consultation_documents v WHERE v.patient_id=${alias}.patient_id AND v.consultation_id=${alias}.id`);
 if(kind==='examination')parts.push(`SELECT v.document_id FROM examination_documents v WHERE v.patient_id=${alias}.patient_id AND v.examination_id=${alias}.id`);
 if(['condition','treatment','measurement','examination'].includes(kind))parts.push(`SELECT v.document_id FROM consultation_documents v WHERE v.patient_id=${alias}.patient_id AND v.consultation_id=${alias}.consultation_id`);
 if(kind==='measurement')parts.push(`SELECT v.document_id FROM examination_documents v WHERE v.patient_id=${alias}.patient_id AND v.examination_id=${alias}.examination_id`);
 if(kind==='treatment')parts.push(`SELECT i.document_id FROM consultation_import_records i JOIN patient_medications pm ON pm.patient_id=i.patient_id AND pm.id=i.resource_id WHERE i.patient_id=${alias}.patient_id AND i.kind='medication' AND pm.treatment_id=${alias}.id`);
 return parts.join(' UNION ');
}
export function recordDocumentsSql(alias:string,kind:Kind,roleSql:string='$2'){
 return `COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'name',d.file_name,'date',d.document_date,'withdrawn',d.archived_at IS NOT NULL) ORDER BY d.file_name,d.id) FROM medical_documents d WHERE d.patient_id=${alias}.patient_id AND d.id IN (${recordSourceIds(alias,kind)}) AND d.status='ready' AND (${roleSql}='admin' OR d.visible_to_patient)),'[]'::jsonb)`;
}
export function reportRecordSql(alias:string,kind:Kind){
 const ids=recordSourceIds(alias,kind);
 return `(${alias}.status='published' AND (NOT EXISTS(SELECT 1 FROM (${ids}) sources) OR EXISTS(SELECT 1 FROM medical_documents d WHERE d.patient_id=${alias}.patient_id AND d.id IN (${ids}) AND d.status='ready' AND d.archived_at IS NULL)))`;
}

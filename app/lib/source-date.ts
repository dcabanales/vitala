// Use a source date only when the linked sources agree; never use upload time.
export function sourceDateSql(alias:string,kind:'treatment'|'medication'){
 const match=kind==='treatment'?`(i.kind='treatment' AND i.resource_id=${alias}.id OR i.kind='medication' AND i.resource_id IN (SELECT pm.id FROM patient_medications pm WHERE pm.patient_id=${alias}.patient_id AND pm.treatment_id=${alias}.id))`:`i.kind='medication' AND i.resource_id=${alias}.id`;
 return `(SELECT CASE WHEN count(DISTINCT COALESCE(c.event_date,e.event_date,d.document_date))=1 THEN min(COALESCE(c.event_date,e.event_date,d.document_date)) END FROM consultation_import_records i LEFT JOIN consultations c ON c.id=i.consultation_id AND c.patient_id=i.patient_id LEFT JOIN examinations e ON e.id=i.examination_id AND e.patient_id=i.patient_id JOIN medical_documents d ON d.id=i.document_id AND d.patient_id=i.patient_id WHERE i.patient_id=${alias}.patient_id AND (${match}))`;
}

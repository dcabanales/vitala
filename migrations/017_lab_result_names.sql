ALTER TABLE measurements ADD COLUMN name_as_documented text CHECK(length(trim(name_as_documented)) BETWEEN 1 AND 160);
-- Recover only an unambiguous exact match from the confirmed source draft.
WITH candidates AS (
 SELECT m.id, min(item->>'typeName') AS name
 FROM measurements m JOIN extraction_runs r ON r.examination_id=m.examination_id
   AND r.patient_id=m.patient_id AND r.document_id=m.document_id AND r.status='confirmed'
 CROSS JOIN LATERAL jsonb_array_elements(r.draft->'measurements') item
 WHERE m.name_as_documented IS NULL AND m.version=1
   AND item->>'originalValue'=m.original_value
   AND NULLIF(item->>'unit','') IS NOT DISTINCT FROM NULLIF(m.unit,'')
   AND NULLIF(item->>'referenceRange','') IS NOT DISTINCT FROM NULLIF(m.reference_range,'')
   AND length(trim(item->>'typeName')) BETWEEN 1 AND 160
 GROUP BY m.id HAVING count(*)=1
)
UPDATE measurements m SET name_as_documented=c.name FROM candidates c WHERE c.id=m.id;

CREATE TABLE examination_interpretations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL, examination_id uuid NOT NULL,
 source_hash text NOT NULL, model text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','failed')),
 content jsonb, created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(patient_id,examination_id) REFERENCES examinations(patient_id,id)
);
CREATE INDEX examination_interpretations_recent ON examination_interpretations(examination_id,created_at DESC);

CREATE TABLE patient_summaries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL REFERENCES patients(id),
 source_hash text NOT NULL,
 model text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','failed')),
 content text,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz
);
CREATE INDEX patient_summaries_lookup ON patient_summaries(patient_id,source_hash,created_at DESC);
ALTER TABLE extraction_runs ADD COLUMN purpose text NOT NULL DEFAULT 'clinical' CHECK(purpose IN ('clinical','prescription'));
ALTER TABLE treatments ADD COLUMN doctor_as_documented text;

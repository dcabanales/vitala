ALTER TABLE medical_history_events ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE TABLE clinical_fact_revisions (
 id bigserial PRIMARY KEY,
 patient_id uuid NOT NULL REFERENCES patients(id),
 resource_type text NOT NULL CHECK(resource_type IN ('condition','allergy','history_event')),
 resource_id uuid NOT NULL,
 previous_version integer NOT NULL,
 snapshot jsonb NOT NULL,
 reason text NOT NULL,
 changed_by uuid NOT NULL REFERENCES users(id),
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE extraction_runs ADD COLUMN identity_review jsonb;
ALTER TABLE extraction_runs ADD COLUMN original_draft jsonb;
UPDATE extraction_runs SET original_draft=draft WHERE draft IS NOT NULL;

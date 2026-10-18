ALTER TABLE patient_conditions ADD COLUMN document_id uuid;
ALTER TABLE patient_conditions ADD FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id);
ALTER TABLE allergies ADD COLUMN document_id uuid;
ALTER TABLE allergies ADD FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id);
ALTER TABLE patient_medications ADD COLUMN document_id uuid;
ALTER TABLE patient_medications ADD FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id);
CREATE TABLE medical_history_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  kind text NOT NULL CHECK(kind IN ('surgery','hospitalization','personal','family','other')),
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  detail text,
  documented_date date,
  family_relation text,
  document_id uuid,
  status text NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','void')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id)
);
CREATE INDEX history_patient_idx ON medical_history_events(patient_id,documented_date DESC NULLS LAST);

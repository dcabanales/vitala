CREATE TABLE consultation_import_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,consultation_id uuid,examination_id uuid,document_id uuid NOT NULL,
 kind text NOT NULL,name_key text NOT NULL,resource_id uuid NOT NULL,
 snapshot jsonb NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(patient_id,examination_id) REFERENCES examinations(patient_id,id),
 FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id),
 FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id),
 UNIQUE(document_id,kind,name_key)
);

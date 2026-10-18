ALTER TABLE care_tasks ADD COLUMN document_id uuid;
ALTER TABLE care_tasks ADD COLUMN consultation_id uuid;
ALTER TABLE care_tasks ADD COLUMN examination_id uuid;
ALTER TABLE care_tasks ADD CONSTRAINT care_task_document_fk FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id);
ALTER TABLE care_tasks ADD CONSTRAINT care_task_consultation_fk FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id);
ALTER TABLE care_tasks ADD CONSTRAINT care_task_examination_fk FOREIGN KEY(patient_id,examination_id) REFERENCES examinations(patient_id,id);
ALTER TABLE care_tasks ADD CONSTRAINT care_task_one_record CHECK(NOT(consultation_id IS NOT NULL AND examination_id IS NOT NULL));
CREATE UNIQUE INDEX care_task_document_unique ON care_tasks(document_id) WHERE document_id IS NOT NULL;
CREATE TABLE medication_guides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 medication_id uuid NOT NULL REFERENCES medications(id),
 source_hash text NOT NULL,
 model text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','failed')),
 content text,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz
);
CREATE INDEX medication_guides_cached ON medication_guides(medication_id,source_hash,created_at DESC);

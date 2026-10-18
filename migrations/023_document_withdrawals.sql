CREATE TABLE document_withdrawals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 document_id uuid NOT NULL,
 items jsonb NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 restored_by uuid REFERENCES users(id),
 restored_at timestamptz,
 FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id)
);
CREATE UNIQUE INDEX document_withdrawals_active ON document_withdrawals(document_id) WHERE restored_at IS NULL;

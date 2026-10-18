CREATE TABLE extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  document_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('consultation','examination','general')),
  status text NOT NULL CHECK(status IN ('running','review','failed','confirmed','interrupted')),
  model text NOT NULL,
  schema_version integer NOT NULL,
  draft jsonb,
  warning text,
  error_code text,
  input_tokens integer,
  output_tokens integer,
  created_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  consultation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id),
  FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id)
);
CREATE INDEX extraction_document_idx ON extraction_runs(document_id,created_at DESC);
CREATE UNIQUE INDEX extraction_one_running ON extraction_runs(patient_id) WHERE status='running';

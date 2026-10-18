CREATE TABLE medical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 10485760),
  sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
  object_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','error')),
  visible_to_patient boolean NOT NULL DEFAULT false,
  document_date date,
  specialty_id uuid REFERENCES medical_specialties(id),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id,id)
);
CREATE INDEX medical_documents_patient_idx ON medical_documents(patient_id,created_at DESC);
CREATE UNIQUE INDEX medical_documents_hash_unique ON medical_documents(patient_id,sha256) WHERE status='ready';
CREATE TABLE consultation_documents (
  patient_id uuid NOT NULL,
  consultation_id uuid NOT NULL,
  document_id uuid NOT NULL,
  PRIMARY KEY(consultation_id,document_id),
  FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id),
  FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id)
);

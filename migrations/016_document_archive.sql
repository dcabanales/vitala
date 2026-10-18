ALTER TABLE medical_documents ADD COLUMN archived_at timestamptz;
DROP INDEX medical_documents_hash_unique;
CREATE UNIQUE INDEX medical_documents_hash_unique ON medical_documents(patient_id,sha256) WHERE status='ready' AND archived_at IS NULL;

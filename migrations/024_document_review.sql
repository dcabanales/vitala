ALTER TABLE medical_documents ADD COLUMN reviewed_at timestamptz;
ALTER TABLE medical_documents ADD COLUMN reviewed_by uuid REFERENCES users(id);

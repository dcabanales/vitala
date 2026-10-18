ALTER TABLE clinical_fact_revisions DROP CONSTRAINT clinical_fact_revisions_resource_type_check;
ALTER TABLE clinical_fact_revisions ADD CONSTRAINT clinical_fact_revisions_resource_type_check CHECK(resource_type IN ('condition','allergy','history_event','medication_use','measurement'));
ALTER TABLE invitations ADD COLUMN revoked_at timestamptz;
ALTER TABLE extraction_runs ADD COLUMN review_version integer NOT NULL DEFAULT 1;

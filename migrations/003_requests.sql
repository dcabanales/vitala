ALTER TABLE consultations ADD COLUMN request_key uuid;
CREATE UNIQUE INDEX consultations_request_unique ON consultations(patient_id,request_key) WHERE request_key IS NOT NULL;
ALTER TABLE treatments ADD COLUMN request_key uuid;
CREATE UNIQUE INDEX treatments_request_unique ON treatments(patient_id,request_key) WHERE request_key IS NOT NULL;

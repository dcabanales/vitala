ALTER TABLE extraction_runs ADD COLUMN examination_id uuid;
ALTER TABLE extraction_runs ADD FOREIGN KEY(patient_id,examination_id)
  REFERENCES examinations(patient_id,id);

ALTER TABLE examinations ADD COLUMN doctor_as_documented text;
ALTER TABLE examinations ADD COLUMN center_as_documented text;
ALTER TABLE examinations ADD COLUMN specialty_as_documented text;

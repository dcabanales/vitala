CREATE TABLE treatment_revisions (
  id bigserial PRIMARY KEY,
  treatment_id uuid NOT NULL REFERENCES treatments(id),
  patient_id uuid NOT NULL,
  previous_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(patient_id,treatment_id) REFERENCES treatments(patient_id,id)
);
CREATE TABLE consultation_revisions (
  id bigserial PRIMARY KEY,
  consultation_id uuid NOT NULL REFERENCES consultations(id),
  patient_id uuid NOT NULL,
  previous_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id)
);

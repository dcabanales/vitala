ALTER TABLE examinations ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE examination_revisions (
  id bigserial PRIMARY KEY,
  examination_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  previous_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
  changed_by uuid NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(patient_id,examination_id) REFERENCES examinations(patient_id,id)
);

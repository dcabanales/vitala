CREATE TABLE care_followup (
 patient_id uuid NOT NULL REFERENCES patients(id),
 kind text NOT NULL CHECK(kind IN ('treatment','medication')),
 resource_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('followed','not_followed','unknown')),
 updated_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(patient_id,kind,resource_id)
);

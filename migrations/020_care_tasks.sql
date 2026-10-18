CREATE TABLE care_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL REFERENCES patients(id),
 request_key uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('consultation','examination')),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 scheduled_date date,
 scheduled_time time,
 doctor_id uuid REFERENCES doctors(id),
 center_id uuid REFERENCES medical_centers(id),
 specialty_id uuid REFERENCES medical_specialties(id),
 notes text CHECK(length(notes)<=4000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
 version integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(scheduled_time IS NULL OR scheduled_date IS NOT NULL),
 UNIQUE(patient_id,request_key)
);
CREATE INDEX care_tasks_patient_status ON care_tasks(patient_id,status,scheduled_date);

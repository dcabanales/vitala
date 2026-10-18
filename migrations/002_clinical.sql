CREATE TABLE medical_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO medical_specialties(name) VALUES
  ('Medicina general'),('Cardiología'),('Endocrinología'),('Neurología'),('Traumatología'),
  ('Dermatología'),('Gastroenterología'),('Neumología'),('Ginecología'),('Urología'),
  ('Oftalmología'),('Otorrinolaringología'),('Psiquiatría'),('Psicología'),('Reumatología'),
  ('Oncología'),('Nefrología'),('Pediatría'),('Alergología'),('Fisioterapia'),('Nutrición')
ON CONFLICT(name) DO NOTHING;

CREATE TABLE medical_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  kind text,
  city text,
  country text,
  address text,
  contact text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medical_centers_name_idx ON medical_centers(name);

CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  registration text,
  jurisdiction text,
  contact text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX doctors_name_idx ON doctors(name);
CREATE TABLE doctor_specialties (
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  specialty_id uuid NOT NULL REFERENCES medical_specialties(id),
  PRIMARY KEY(doctor_id,specialty_id)
);
CREATE TABLE doctor_centers (
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  center_id uuid NOT NULL REFERENCES medical_centers(id),
  PRIMARY KEY(doctor_id,center_id)
);

CREATE TABLE consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','void')),
  event_date date,
  doctor_id uuid REFERENCES doctors(id),
  center_id uuid REFERENCES medical_centers(id),
  specialty_id uuid REFERENCES medical_specialties(id),
  doctor_as_documented text,
  center_as_documented text,
  reason text,
  symptoms text,
  summary text,
  findings text,
  impression text,
  conclusion text,
  recommendations text,
  follow_up text,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id,id)
);
CREATE INDEX consultations_patient_date_idx ON consultations(patient_id,event_date DESC NULLS LAST,created_at DESC);

CREATE TABLE medical_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 180),
  description text,
  specialty_id uuid REFERENCES medical_specialties(id),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE patient_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  condition_id uuid NOT NULL REFERENCES medical_conditions(id),
  consultation_id uuid,
  state text NOT NULL DEFAULT 'unknown' CHECK(state IN ('active','resolved','historical','unknown')),
  certainty text NOT NULL DEFAULT 'unknown' CHECK(certainty IN ('confirmed','suspected','unknown')),
  documented_date date,
  note text,
  source_note text,
  status text NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','void')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id,id),
  FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id)
);
CREATE INDEX patient_conditions_patient_idx ON patient_conditions(patient_id);

CREATE TABLE allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  substance text NOT NULL CHECK(length(trim(substance)) BETWEEN 1 AND 180),
  kind text NOT NULL DEFAULT 'allergy' CHECK(kind IN ('allergy','intolerance')),
  reaction text,
  severity text,
  state text NOT NULL DEFAULT 'unknown' CHECK(state IN ('active','resolved','unknown')),
  documented_date date,
  source_note text,
  status text NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','void')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id,id)
);
CREATE INDEX allergies_patient_idx ON allergies(patient_id);

CREATE TABLE treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  consultation_id uuid,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  indication text,
  doctor_id uuid REFERENCES doctors(id),
  start_date date,
  end_date date,
  state text NOT NULL DEFAULT 'unknown' CHECK(state IN ('planned','active','completed','suspended','paused','unknown')),
  instructions text,
  note text,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','void')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id,id),
  FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id),
  CHECK(end_date IS NULL OR start_date IS NULL OR end_date>=start_date)
);
CREATE INDEX treatments_patient_idx ON treatments(patient_id,state,status);

CREATE TABLE medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 200),
  active_ingredient text,
  description text,
  source text,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE patient_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  medication_id uuid NOT NULL REFERENCES medications(id),
  treatment_id uuid,
  dose text,
  frequency text,
  route text,
  instructions text,
  start_date date,
  end_date date,
  state text NOT NULL DEFAULT 'unknown' CHECK(state IN ('planned','active','completed','suspended','paused','unknown')),
  status text NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','void')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id,id),
  FOREIGN KEY(patient_id,treatment_id) REFERENCES treatments(patient_id,id)
);

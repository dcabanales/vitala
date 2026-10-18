CREATE TABLE examinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  consultation_id uuid,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  event_date date,
  specialty_id uuid REFERENCES medical_specialties(id),
  doctor_id uuid REFERENCES doctors(id),
  center_id uuid REFERENCES medical_centers(id),
  indication text,
  findings text,
  conclusion text,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','void')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id,id),
  FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id)
);
CREATE INDEX exams_patient_date_idx ON examinations(patient_id,event_date DESC NULLS LAST);
CREATE TABLE examination_documents (
  patient_id uuid NOT NULL,
  examination_id uuid NOT NULL,
  document_id uuid NOT NULL,
  PRIMARY KEY(examination_id,document_id),
  FOREIGN KEY(patient_id,examination_id) REFERENCES examinations(patient_id,id),
  FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id)
);
CREATE TABLE measurement_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 160),
  category text NOT NULL DEFAULT 'other' CHECK(category IN ('vital','laboratory','other')),
  value_kind text NOT NULL CHECK(value_kind IN ('number','text','code','interval','components')),
  default_unit text,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO measurement_types(name,category,value_kind,default_unit) VALUES
  ('Peso','vital','number','kg'),('Frecuencia cardíaca','vital','number','lpm'),
  ('Presión arterial','vital','components','mmHg'),('Glucosa','laboratory','number','mg/dL'),
  ('Observación clínica','other','text',NULL) ON CONFLICT(name) DO NOTHING;
CREATE TABLE measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  type_id uuid NOT NULL REFERENCES measurement_types(id),
  consultation_id uuid,
  examination_id uuid,
  document_id uuid,
  documented_date date,
  value_kind text NOT NULL CHECK(value_kind IN ('number','text','code','interval','components')),
  numeric_value numeric,
  text_value text,
  code_value text,
  components jsonb,
  comparator text CHECK(comparator IN ('<','<=','=','>=','>')),
  original_value text NOT NULL,
  unit text,
  reference_range text,
  sample text,
  context_note text,
  status text NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','void')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(patient_id,consultation_id) REFERENCES consultations(patient_id,id),
  FOREIGN KEY(patient_id,examination_id) REFERENCES examinations(patient_id,id),
  FOREIGN KEY(patient_id,document_id) REFERENCES medical_documents(patient_id,id),
  CHECK(num_nonnulls(consultation_id,examination_id)<=1),
  CHECK((value_kind='number' AND numeric_value IS NOT NULL)
     OR (value_kind='text' AND text_value IS NOT NULL)
     OR (value_kind='code' AND code_value IS NOT NULL)
     OR (value_kind='interval' AND numeric_value IS NOT NULL AND comparator IS NOT NULL)
     OR (value_kind='components' AND components IS NOT NULL))
);
CREATE INDEX measurements_patient_date_idx ON measurements(patient_id,documented_date DESC NULLS LAST);

CREATE TABLE assistant_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL REFERENCES patients(id),
 user_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL CHECK(status IN ('running','completed','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz
);
CREATE INDEX assistant_requests_usage ON assistant_requests(user_id,created_at DESC);

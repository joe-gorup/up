-- Add the durable, profile-level source used for all new shared timeline notes.
-- Existing guardian_notes, coach_notes, and coach_checkins rows remain in place
-- and continue to be aggregated at read time.
CREATE TABLE IF NOT EXISTS profile_notes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  scooper_id varchar NOT NULL,
  author_id varchar,
  author_role_snapshot text NOT NULL,
  body text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_id varchar,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_notes_scooper_id_employees_id_fk
    FOREIGN KEY (scooper_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT profile_notes_author_id_employees_id_fk
    FOREIGN KEY (author_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS profile_notes_scooper_id_idx
  ON profile_notes (scooper_id);

CREATE INDEX IF NOT EXISTS profile_notes_author_id_idx
  ON profile_notes (author_id);

CREATE INDEX IF NOT EXISTS profile_notes_source_type_idx
  ON profile_notes (source_type);

CREATE INDEX IF NOT EXISTS profile_notes_status_idx
  ON profile_notes (status);
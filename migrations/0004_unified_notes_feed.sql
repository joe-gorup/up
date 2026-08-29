-- Guardian notes are now a timeline. Existing rows stay intact; only the
-- legacy one-row-per-guardian/scooper constraint is removed.
ALTER TABLE guardian_notes
  DROP CONSTRAINT IF EXISTS guardian_notes_unique;
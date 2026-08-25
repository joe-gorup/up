ALTER TABLE promotion_certifications
  ADD COLUMN IF NOT EXISTS response_set_id varchar;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'promotion_certifications_response_set_id_form_response_sets_id_fk'
  ) THEN
    ALTER TABLE promotion_certifications
      ADD CONSTRAINT promotion_certifications_response_set_id_form_response_sets_id_fk
      FOREIGN KEY (response_set_id) REFERENCES form_response_sets(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS promotion_certs_response_set_idx
  ON promotion_certifications (response_set_id);

CREATE UNIQUE INDEX IF NOT EXISTS promotion_certs_response_set_unique
  ON promotion_certifications (response_set_id)
  WHERE response_set_id IS NOT NULL;

-- Upgrade the previous default for Shift Leads (view enabled, modify disabled)
-- without re-enabling an intentional full opt-out.
UPDATE role_permissions
SET can_modify = true
WHERE role = 'Shift Lead'
  AND feature = 'form_responses'
  AND can_view = true
  AND can_modify = false;
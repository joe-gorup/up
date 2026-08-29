-- Migration: Add per-step training videos and goal-step → template-step linkage
-- Date: 2026-04-21
-- Description:
--   1. Adds nullable `goal_steps.template_step_id` (FK → goal_template_steps,
--      ON DELETE SET NULL) so each assigned goal step remembers which template
--      step it originated from. Used to surface per-step videos on assigned
--      goals without rewriting historical data.
--   2. Creates the new `goal_template_step_videos` join table connecting
--      template steps to videos, with display_order and a uniqueness constraint
--      so the same video cannot be linked twice to one step.
--   3. Backfills `goal_steps.template_step_id` for existing goals by matching
--      step_order within the parent goal's template.
--
-- All changes are additive and idempotent (IF NOT EXISTS / ON CONFLICT).

-- 1. Add the FK column on goal_steps
ALTER TABLE goal_steps
  ADD COLUMN IF NOT EXISTS template_step_id VARCHAR;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'goal_steps_template_step_id_fkey'
      AND table_name = 'goal_steps'
  ) THEN
    ALTER TABLE goal_steps
      ADD CONSTRAINT goal_steps_template_step_id_fkey
      FOREIGN KEY (template_step_id)
      REFERENCES goal_template_steps(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS goal_steps_template_step_id_idx
  ON goal_steps(template_step_id);

-- 2. Create the join table
CREATE TABLE IF NOT EXISTS goal_template_step_videos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  template_step_id VARCHAR NOT NULL REFERENCES goal_template_steps(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS goal_template_step_videos_unique_idx
  ON goal_template_step_videos(template_step_id, video_id);

CREATE INDEX IF NOT EXISTS goal_template_step_videos_step_idx
  ON goal_template_step_videos(template_step_id);

CREATE INDEX IF NOT EXISTS goal_template_step_videos_video_idx
  ON goal_template_step_videos(video_id);

-- 3. Backfill goal_steps.template_step_id from matching step_order in template
UPDATE goal_steps AS gs
SET template_step_id = sub.template_step_id
FROM (
  SELECT gs2.id AS goal_step_id, gts.id AS template_step_id
  FROM goal_steps gs2
  JOIN development_goals dg ON dg.id = gs2.goal_id
  JOIN goal_template_steps gts
    ON gts.template_id = dg.template_id
   AND gts.step_order = gs2.step_order
  WHERE gs2.template_step_id IS NULL
    AND dg.template_id IS NOT NULL
) AS sub
WHERE gs.id = sub.goal_step_id;

COMMENT ON COLUMN goal_steps.template_step_id IS
  'Originating template step id; nullable to preserve legacy goal_steps not derived from a template';
COMMENT ON TABLE goal_template_step_videos IS
  'Per-step training videos attached to goal_template_steps';

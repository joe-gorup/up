-- Add accommodations column for tools and environmental supports (e.g. magnifying glass, adaptive grippers)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS accommodations jsonb DEFAULT '[]'::jsonb;

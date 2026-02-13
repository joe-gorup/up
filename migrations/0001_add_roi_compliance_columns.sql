-- Migration: Add ROI compliance columns to employees table
-- Date: 2026-02-13
-- Description: Adds date_of_birth, roi_status, and roi_signed_at columns for compliance gate

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS roi_status BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS roi_signed_at TIMESTAMP WITH TIME ZONE;

-- Create index for roi_status for efficient filtering
CREATE INDEX IF NOT EXISTS employees_roi_status_idx ON employees(roi_status);

COMMENT ON COLUMN employees.date_of_birth IS 'Employee date of birth for verification';
COMMENT ON COLUMN employees.roi_status IS 'Whether the employee/guardian has signed the ROI agreement';
COMMENT ON COLUMN employees.roi_signed_at IS 'Timestamp when the ROI was signed';

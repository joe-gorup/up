# Golden Scoop - Development Guidelines

These guidelines apply to ALL developers and AI coding tools working on this project. Read and follow them before making any changes.

## Core Principle: Protect Production Data

This application has real production data in use since September 2025. Every change MUST preserve existing data integrity. There is no tolerance for data loss.

---

## Database Rules

### 1. Schema Changes Must Be Additive Only
- **ALLOWED**: Adding new tables, adding new nullable columns, adding new indexes
- **NEVER**: Dropping columns, renaming columns, changing column types, dropping tables
- **NEVER**: Changing primary key types (serial vs varchar/UUID)
- **NEVER**: Adding NOT NULL constraints to existing columns without a default value
- If you need to "rename" a column, create a new column, migrate data, then deprecate the old one in a future release

### 2. Legacy Fields
- `employees.name` is a legacy NOT NULL field. Always populate it when creating employees: set it to `${first_name} ${last_name}`. Do not remove or make it nullable without an explicit migration plan.
- Always use `first_name` and `last_name` for display purposes, falling back to `name` if they are null.

### 3. Migration Process
- Never write raw SQL migration files manually
- Use `npm run db:push` to sync schema changes
- If `db:push` shows a data-loss warning, STOP and investigate. Only use `--force` if the warning is about adding a new table or column with a safe default
- Before publishing to production, verify schema diff is additive only

### 4. Foreign Keys
- All new foreign key references to existing tables must use `onDelete: "cascade"` only when the child data is meaningless without the parent
- For new relationship tables (e.g., coach_assignments), cascading deletes are fine
- Never add cascade deletes to core data tables (step_progress, development_goals, assessment_sessions) without explicit approval

### 5. Data Deletion
- All DELETE endpoints must be protected by authentication and role-based access
- Only the data creator or an Administrator should be able to delete records
- Never implement bulk delete operations on core tables (employees, development_goals, step_progress, goal_templates, assessment_sessions)
- Always use soft deletes (status flags) for core business data when possible

---

## Code Architecture Rules

### 1. API Endpoint Security
- Every API endpoint must use `authenticateToken` middleware
- Role-restricted endpoints must use `requireRole()` or manual role checks
- Job Coach endpoints must verify coach-to-employee assignment before allowing access
- Guardian endpoints must verify guardian-to-scooper relationship

### 2. Schema-First Development
- Always update `shared/schema.ts` FIRST when adding new data models
- Create the insert schema, insert type, and select type for every new table
- Update `server/storage.ts` interface if adding CRUD operations

### 3. Frontend Patterns
- Use `apiRequest` from `lib/auth` for all authenticated API calls
- Use React state management (useState/useEffect) - not tanstack-query for the coach/guardian features
- Follow existing component patterns: rounded-xl borders, blue-600 primary buttons, gray-100 backgrounds
- Mobile responsive: test at 375px width minimum

### 4. File Organization
- API routes go in `server/routes.ts`
- Database schema in `shared/schema.ts`
- Frontend pages in `client/src/pages/` or `client/src/components/`
- Reusable UI in `client/src/components/ui/`

---

## Production Deployment Checklist

Before publishing any changes to production:

1. **Schema Safety**: Run `npm run db:push` in development and confirm no destructive changes
2. **Data Compatibility**: Ensure all new columns are nullable or have safe defaults
3. **Backward Compatibility**: Existing API responses must not change shape in breaking ways (adding fields is OK, removing/renaming is not)
4. **Role Access**: Verify new endpoints enforce proper role-based access control
5. **Error Handling**: All endpoints must return proper error responses, never crash the server
6. **No Mock Data**: Never leave mock/placeholder data in production code paths

---

## Current Production Schema (Baseline)

These tables and columns exist in production and MUST NOT be altered destructively:

### Core Tables (with production data)
- `employees` (57 records) - id, name, first_name, last_name, email, role, profile_image_url, is_active, allergies, emergency_contacts, interests_motivators, challenges, regulation_strategies, has_system_access, password, last_login, created_at, updated_at
- `goal_templates` (85 records) - id, name, goal_statement, default_mastery_criteria, default_target_date, status, relative_target_duration, created_at, updated_at
- `goal_template_steps` (1377 records) - id, template_id, step_order, step_description, is_required, timer_required, timer_type, created_at
- `development_goals` (24 records) - id, employee_id, title, description, start_date, target_end_date, status, mastery_achieved, mastery_date, consecutive_all_correct, created_at, updated_at
- `goal_steps` (298 records) - id, goal_id, step_order, step_description, is_required, created_at
- `step_progress` (430 records) - id, development_goal_id, goal_step_id, employee_id, date, outcome, notes, assessment_session_id, status, documenter_user_id, completion_time_seconds, timer_manually_entered, created_at, updated_at
- `assessment_sessions` (81 records) - id, manager_id, date, location, employee_ids, notes, status, locked_by, locked_at, expires_at, created_at, updated_at
- `assessment_summaries` (14 records) - id, employee_id, assessment_session_id, date, summary, created_at, updated_at

### New Tables (added in development, not yet in production)
- `coach_assignments` - coach-to-scooper linking
- `guardian_relationships` - guardian-to-scooper linking
- `account_invitations` - setup tokens
- `coach_checkins` - structured visit notes
- `coach_files` - uploaded documents
- `coach_notes` - rich text notes
- `promotion_certifications` - mentor/shift lead certs

### New Columns on employees (added in development, not yet in production)
- date_of_birth, roi_status, roi_signed_at, roi_signature, roi_consent_type, roi_no_release_details
- roi_guardian_name, roi_guardian_address, roi_guardian_city_state_zip, roi_guardian_phone, roi_guardian_relationship
- has_service_provider, service_providers

All new columns are nullable with safe defaults - publishing will add them without affecting existing data.

---

## Role Reference

| Role | Access Level |
|------|-------------|
| Administrator | Full access to everything |
| Shift Lead | Can document assessments, view all scoopers |
| Assistant Manager | Can document assessments, view all scoopers |
| Job Coach | Can only access assigned scoopers (via coach_assignments) |
| Guardian | Can only view assigned scoopers (via guardian_relationships) |
| Super Scooper | Employee being tracked, minimal system access |

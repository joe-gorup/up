# Unique Pathway - Development Guidelines

These guidelines apply to ALL developers and AI coding tools working on this project. Read and follow them before making any changes.

## Core Principle: Protect Production Data

This application has real production data in use since September 2025. Every change MUST preserve existing data integrity. There is no tolerance for data loss.

---

## Security Rules

### 1. Authentication & Authorization
- Every API endpoint MUST use `authenticateToken` middleware — no exceptions
- Role-restricted endpoints MUST use `requireRole()` or `requirePermission()` middleware
- Job Coach endpoints MUST verify coach-to-employee assignment via `coach_assignments` before allowing access
- Guardian endpoints MUST verify guardian-to-scooper relationship via `guardian_relationships`
- NEVER trust client-sent user identity fields (e.g., `assigned_by`, `created_by`). Always derive these from `req.user` on the server side.
- Administrator bypass is acceptable for `requirePermission()` but still requires `authenticateToken`

### 2. Input Validation & Mass Assignment
- ALL write endpoints (POST/PUT/PATCH) MUST use field allowlisting via `pickAllowedFields()` or Zod schema validation before inserting/updating
- NEVER pass `req.body` directly to `db.insert()` or `db.update()` — this allows mass assignment of `id`, `created_at`, `role`, and other protected fields
- Use the Zod `insert*Schema` from `shared/schema.ts` to validate request bodies where available
- Validate and sanitize all user input on the server side, even if validated on the client

### 3. Secrets & Configuration
- NEVER hardcode JWT secrets, API keys, database credentials, or passwords in source code
- All secrets MUST come from environment variables
- NEVER commit `.env` files, credentials, or tokens to the repository
- Demo/seed endpoints (e.g., `/api/create-demo-users`) MUST be protected by auth + admin role check, or removed from production builds

### 4. Password Security
- Passwords MUST be hashed with bcrypt (minimum 12 salt rounds, already configured in `auth.ts`)
- NEVER return password hashes in API responses — use `stripSensitiveFields()` on all employee/user objects before returning
- Enforce password complexity: minimum 12 characters, mixed case, digit, and special character — validate both client-side and server-side
- Invitation tokens MUST be single-use and time-limited

### 5. XSS Prevention
- ALL user-generated HTML content (e.g., from TipTap rich text editor) MUST be sanitized with DOMPurify before rendering
- NEVER use `dangerouslySetInnerHTML` or equivalent without sanitization
- Escape user input in any context where it could be interpreted as HTML or JavaScript

### 6. API Response Safety
- NEVER include password hashes, tokens, or internal system details in API responses
- Use `stripSensitiveFields()` / `stripSensitiveFieldsArray()` helpers consistently
- Error messages shown to users should be generic; log detailed errors server-side only

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

### 5. Data Deletion & Updates
- All DELETE endpoints must be protected by authentication and role-based access
- Only the data creator or an Administrator should be able to delete records
- Never implement bulk delete operations on core tables (employees, development_goals, step_progress, goal_templates, assessment_sessions)
- Always use soft deletes (status flags) for core business data when possible
- All UPDATE/DELETE queries on core tables must include explicit WHERE clauses - never update or delete without a filter
- Log all destructive operations (deletes, bulk updates) with user ID and affected record IDs

### 6. New Column Compatibility
- All new columns MUST be nullable or have a safe default value
- Code that reads new columns must handle NULL gracefully (use `??`, `||`, or explicit null checks)
- When transitioning from a legacy field to new fields, keep the legacy field populated during the transition period
- Test that existing production records (which will have NULL for new columns) display and function correctly

### 7. Demo & Seed Data
- Demo data endpoints (e.g., `/api/create-demo-users`) must NEVER be accessible in production without admin authentication
- Demo/seed scripts should check for existing data before inserting to avoid duplicates
- Never hard-code demo passwords or credentials that could be used in production

### 8. Query Performance
- Avoid N+1 query patterns — use JOINs or subqueries instead of looping database calls
- Use the indexes defined in `shared/schema.ts` — add new indexes for frequently filtered/sorted columns
- For list endpoints returning many records, consider pagination

---

## Code Quality Rules

### 1. TypeScript & Type Safety
- NEVER use `as any` — define proper types for all variables, parameters, and return values
- Create a typed `AuthenticatedRequest` interface for route handlers instead of casting `(req as any).user`
- Use Zod schemas from `shared/schema.ts` for runtime validation; use TypeScript types for compile-time safety
- All new functions must have explicit parameter types and return types

### 2. Error Handling
- NEVER use empty catch blocks — at minimum log the error and show user feedback
- Server-side: log errors with `logger.error()` and return appropriate HTTP status codes
- Client-side: use the `useToast` hook from `client/src/hooks/use-toast.ts` for user-visible error messages
- NEVER use `console.log` for error handling; use the structured `logger` on the server
- Remove all `console.log` debug statements before committing

### 3. No Browser Dialogs
- NEVER use `alert()`, `confirm()`, or `prompt()` in the application
- Use `useToast` for notifications and status messages
- Build a reusable `ConfirmDialog` component using the existing `Modal` for destructive action confirmations

### 4. No Page Reloads in SPA
- NEVER use `window.location.reload()` — refresh state via DataContext or re-fetch the relevant data
- After mutations, invalidate or refresh the affected data in the context/cache

### 5. Dead Code Cleanup
- Remove unused imports, variables, functions, and components immediately
- Do not leave commented-out code blocks
- Do not leave TODO comments for extended periods — resolve or file as issues

### 6. Consistent Patterns
- Use `apiRequest` from `client/src/lib/auth.ts` for ALL API calls — never use raw `fetch` with manual auth headers
- Use the centralized `LoadingSpinner` component for loading states
- Use the `useToast` hook (not custom toast implementations) for all notifications
- Wrap `JSON.parse()` calls in try/catch when parsing localStorage/sessionStorage values

---

## Frontend Patterns

### 1. Data Fetching
- The app uses DataContext with raw `fetch` + `apiRequest` helper — NOT React Query
- When `replit.md` references `@tanstack/react-query` or `lib/queryClient`, that is WRONG — those do not exist in this project
- All API calls go through `apiRequest` from `client/src/lib/auth.ts`, which handles auth headers and 401 auto-logout
- Do not bypass `apiRequest` by reading tokens from localStorage directly

### 2. Component Size
- Components should not exceed ~500 lines. If a component grows larger, extract sub-components
- Break large components by concern: data fetching, business logic, presentation
- Move hardcoded data arrays (e.g., certification checklists) to constants files or database tables

### 3. State Management
- Use React Context API for shared application state (AuthContext, DataContext)
- Use `useState` for component-local state
- Avoid 50+ `useState` declarations in a single component — this is a sign the component needs to be split
- Use `useReducer` for complex state with many interdependent fields

### 4. UI Components
- Use existing `client/src/components/ui/` components (Modal, Tabs, Button, etc.) — do NOT redefine them locally
- Follow existing styling: rounded-xl borders, blue-600 primary buttons, gray-100 backgrounds
- Mobile responsive: test at 375px width minimum
- All modals must have focus trapping, Escape key handling, and ARIA roles
- All tab panels must have ARIA tab roles and keyboard navigation

### 5. Routing
- Client-side routing uses `wouter` (NOT react-router)
- Route definitions are in `client/src/App.tsx`
- Use `useLocation` and `Link` from wouter for navigation

### 6. Accessibility
- All interactive elements must be keyboard accessible
- Use semantic HTML (`<button>` for actions, `<a>` for links)
- Never nest interactive elements (e.g., `<div onClick>` inside `<button>`)
- Add ARIA labels to icon-only buttons
- Ensure sufficient color contrast (WCAG AA)

---

## API Patterns

### 1. Route Organization
- All routes are currently in `server/routes.ts` — when adding new route groups, consider extracting to `server/routes/` modules using Express Router
- Follow RESTful conventions: GET for reads, POST for creates, PUT/PATCH for updates, DELETE for deletes
- Use consistent URL patterns: `/api/{resource}`, `/api/{resource}/:id`

### 2. Response Format
- Success: `res.json(data)` or `res.json({ message: "..." })`
- Error: `res.status(code).json({ error: "User-friendly message" })`
- Always strip sensitive fields before returning employee/user data
- Use `stripSensitiveFields()` for single objects, `stripSensitiveFieldsArray()` for arrays

### 3. Request Validation
- Validate required fields exist in the request body
- Validate field types and formats (email, date, etc.)
- Use `pickAllowedFields()` to prevent mass assignment
- Return 400 for validation errors with descriptive messages

### 4. Concurrency
- Use PostgreSQL advisory locks (already implemented) for operations that must be atomic
- Disable submit buttons during API calls to prevent double-submission
- Server-side: check for existing records before creating duplicates

---

## Git & PR Hygiene

### 1. Commit Messages
- Use conventional commit format: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Keep commit messages concise but descriptive
- Reference issue numbers when applicable

### 2. Pull Requests
- One logical change per PR — do not bundle unrelated changes
- PR description must include: what changed, why, and how to test
- All PRs must pass lint and type checks before merging

### 3. Branch Naming
- Feature branches: `feat/short-description`
- Bug fixes: `fix/short-description`
- Documentation: `docs/short-description`

---

## Production Deployment Checklist

Before publishing any changes to production:

1. **Schema Safety**: Run `npm run db:push` in development and confirm no destructive changes
2. **Data Compatibility**: Ensure all new columns are nullable or have safe defaults
3. **Backward Compatibility**: Existing API responses must not change shape in breaking ways (adding fields is OK, removing/renaming is not)
4. **Role Access**: Verify new endpoints enforce proper role-based access control
5. **Error Handling**: All endpoints must return proper error responses, never crash the server
6. **No Mock Data**: Never leave mock/placeholder data in production code paths
7. **No Debug Logging**: Remove all `console.log` statements from client code
8. **Security Review**: Verify field allowlisting, auth middleware, and input validation on all new endpoints

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
- `role_permissions` - configurable feature permissions per role

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

---

## Development Workflow

All frontend and backend development is done through Replit Agent. This includes schema changes, API endpoints, UI components, pages, and styles.

**Important:** The app name is "Unique Pathway" (not "Golden Scoop" — that is the legacy name from early development).

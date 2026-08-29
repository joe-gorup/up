# Product Requirements Document
## Golden Scoop — Unique Pathway Employee Development & Support System

### Executive Summary
Golden Scoop (branded as "Unique Pathway by thegoldenscoop.org") is a web-based employee development and support-profile application built for an ice cream shop that employs people with disabilities. It lets managers, job coaches, guardians, and administrators document employee progress on structured, step-by-step skill goals; manage support information; capture reviews, certifications, and check-ins; and share authorized notes. The system is live in production with real data since September 2025.

---

## 1. Product Overview

### 1.1 Purpose
To provide a digital solution for tracking employee skill development, documenting shift-by-shift progress toward mastery of job-related competencies, managing compliance documentation, and enabling job coaches and family guardians to stay connected to employee progress.

### 1.2 Target Users

| Role | Who They Are | What They Do |
|------|-------------|--------------|
| Administrator | Management / ownership | Full access to everything — settings, all employees, all data, permissions |
| Shift Lead | On-floor shift manager | Runs assessments, builds a daily "My Shift" employee list, documents outcomes |
| Assistant Manager | Senior staff | Same as Shift Lead |
| Job Coach | External support professional | Sees only their assigned Super Scoopers; leaves check-in notes and uploads files |
| Guardian | Family member / parent | Views only their loved one's profile; leaves notes for staff |
| Super Scooper | The employee being tracked | Indirect beneficiary; minimal direct system access |

### 1.3 Business Goals
- Standardize skill training and documentation across all shifts and managers
- Provide structured, repeatable assessment sessions tied to mastery criteria
- Keep job coaches and family guardians connected to employee progress
- Meet ROI (Release of Information) compliance requirements with digital consent and signature capture
- Enable data-driven decisions about employee readiness and promotion readiness

---

## 2. Functional Requirements

### 2.1 User Management
**Priority: High**

**Authentication**
- Username/password login stored on the employee record (employees table unified with users)
- Token-based invitation system for onboarding new users — admins generate an invite link; new users complete a setup page to set their password
- Role-based access control enforced on every API endpoint

**User Administration (Admin Only)**
- Invite new users by email token; assign role at invitation time
- Edit existing user roles and access
- Activate or deactivate accounts

### 2.2 Employee (Super Scooper) Profiles
**Priority: High**

**Basic Information**
- First name, last name, email, role
- Profile photo
- Date of birth
- Active / inactive status

**Safety & Support Information**
- Allergies and dietary restrictions (list)
- Emergency contacts (multiple)
- Interests and motivators
- Challenges
- Regulation strategies (de-escalation / support strategies)
- Accommodations (dedicated field, separate from regulation strategies)
- Service provider tracking (flag + provider name, type, and contact details)
- Configurable Support Information labels managed through the Profile Catalog
- Reusable contact relationship options managed by administrators

**ROI Compliance Flow**
- Legal release-of-information text displayed inline
- Consent type selection (Full Release, No Release, Partial Release)
- If No Release: staff records specific restrictions
- Guardian information fields (name, address, phone, relationship)
- Consent toggle checkboxes per the legal text
- Digital signature capture
- ROI status and signed-at timestamp stored on the employee record
- Existing legacy onboarding remains the compliance gate. A limited shared `roi_onboarding` form is also available for consent, signature, and service-provider capture; it does not replace the legacy flow or act as a legal-document CMS.

**Promotion Certifications**
- Track Mentor and Shift Lead certifications
- Record certification date and notes per cert
- View full certification history

### 2.3 Goal Template System
**Priority: High**

**Template Management**
- Create reusable goal templates: title, goal statement, ordered steps, mastery criteria text, relative target duration (e.g., "90 days")
- Add/edit/reorder/delete steps within a template
- Mark individual steps as required or optional
- Assign a timer type per step: none / optional / required
- Attach YouTube video links to individual steps or to the template overall
- Archive templates (removes from active selection without deleting history)

**Production stats:** 85 templates, 1,377 steps

### 2.4 Development Goal Assignment
**Priority: High**

- Assign a goal template to a specific Super Scooper
- Steps are copied from the template at assignment time (snapshot)
- Set a target end date (calculated from the template's relative duration)
- Status: active / completed / archived
- Mastery is tracked via consecutive_all_correct count
- Default mastery criteria: 3 consecutive assessments with all required steps Correct
- Goal progress and mastery status visible on the employee profile

**Production stats:** 24 active development goals

### 2.5 Assessment Sessions
**Priority: High**

**Starting a Session**
- Shift Leads and Admins select a location and start a session from an employee's profile page
- Sessions can cover one or more employees
- One active session per employee at a time (PostgreSQL Advisory Lock prevents race conditions on creation)

**Collaborative Joining**
- If another manager already has a session open for an employee, a banner appears: "[Name] is already assessing this employee — Join session"
- Any authorized user can join the existing session and document alongside the session owner
- No hard lock / no blocked access — collaborative model
- Presence is polled every 15 seconds; an "Also here: [Name]" badge appears inside the assessment for awareness
- Administrators can take over an active session when needed; the previous owner and takeover time are retained
- Sessions expire automatically after 30 minutes of inactivity; abandoned sessions are cleaned up

**Session Locations**
- 9540 Nall Avenue
- 4701 Indian Creek Parkway
- Remote

**Production stats:** 81 assessment sessions

### 2.6 Step-by-Step Assessment (EmployeeProgress)
**Priority: High**

**Assessment Interface**
- Embedded directly in the employee profile — no separate documentation page
- Each active development goal is shown with its steps
- Multi-goal sessions: staff can choose to include or exclude individual goals for the current session using a toggle (excluded goals don't affect mastery)

**Step Outcomes**
- Correct
- Verbal Prompt
- Incorrect
- N/A

**Notes**
- Optional free-text note per step
- Notes saved with each step_progress record

**Per-Step Timer**
- Collapsed by default behind a "Start timer" pill on the step row
- Tapping the pill expands a timer card with: large Start/Stop button, guarded Reset (confirms before resetting, disabled at 00:00), and Manual entry via a small text link
- Live MM:SS count visible on the pill while collapsed
- Timer keeps running while collapsed (mounted, not unmounted)
- Time saved in seconds on submit; flag stored indicating manual vs. timed entry

**Draft & Submit**
- Save Draft: saves all current outcomes and notes without submitting; can be resumed
- Submit: finalizes the session's step progress; triggers mastery recalculation

### 2.7 My Shift Workflow
**Priority: High**

- Shift Leads and Admins use the "My Shift" page to build a working list of employees for the day
- Search employees by name, pin them to the shift list
- Pinned list persists for the session
- Assessments are launched by clicking into an individual employee profile from the shift list

### 2.8 Job Coach Experience — My Scoopers
**Priority: High**

- Job Coaches see only their assigned Super Scoopers (via coach_assignments table)
- No free search — list is fixed to assigned scoopers
- Per-scooper view includes: profile details, active goals, assessment history, contact info

**Check-ins**
- Structured visit notes: date, type, notes, next steps
- Coach check-ins use the shared form-response path when an active `coach_checkin` template exists, while legacy check-in history remains readable during migration

**Coach Notes**
- Rich text notes per scooper (title + formatted content)
- Only the creating coach or an Administrator can edit or delete

**Coach Files**
- Upload files: PDF, TXT, DOC, DOCX, RTF
- Access control: assigned coaches, administrators, and shift leads can view
- Download and delete with ownership enforcement

### 2.9 Guardian Experience — My Loved Ones
**Priority: Medium**

- Guardians see only their linked Super Scoopers (via guardian_relationships table)
- View-only profile: basic info, active goals, assessment history
- Training videos attached to goal steps are visible to guardians (read-only, watch only)

**Guardian Notes**
- Guardian updates appear in the shared, profile-scoped notes timeline
- Authors can edit their own notes; Administrators can delete any note
- Administrators, Shift Leads, Job Coaches, and linked guardians see only notes allowed by the scooper's access policy
- The legacy guardian-note endpoint remains available for compatibility with existing records

### 2.10 Video Links on Goals & Steps
**Priority: Medium**

- Admins can attach YouTube video links to goal templates (template-level) and to individual steps (step-level)
- Videos surface in the assessment interface alongside their step
- Videos are visible to guardians in the "My Loved Ones" view (read-only)
- "Copy link" button on each video card for quick sharing externally
- "Copy all links" action on each goal's video group copies a list of title + URL lines

### 2.11 Configurable Role Permissions
**Priority: Medium**

- Admin-only Permission Settings page
- Matrix grid: features (rows) × roles (columns: Shift Lead, Assistant Manager, Job Coach, Guardian)
- Toggle View / Modify / Delete per feature per role
- Validation: Modify and Delete require View to be enabled
- Administrator always has full access (locked, cannot be changed)
- Changes require an explicit Save action
- Enforced via requirePermission middleware on the backend and usePermissions hook on the frontend
- Search/filter features by name supported

### 2.12 Assessment History & Analytics
**Priority: Medium**

- Full assessment history per employee: date, location, outcomes by step, who documented
- Batch endpoint eliminates N+1 fetching for assessment detail loading
- Client-side profile caching prevents re-fetching data within a session
- Dashboard: key metrics, active goal summary, employee progress overview

### 2.13 Forms & Reviews
**Priority: High**

- Administrators manage form templates from the Forms & Reviews area: create, edit, duplicate, archive, and soft-deactivate templates, sections, questions, and options
- Questions can be reordered within sections; sections can be reordered; stable keys preserve meaning when wording changes
- Supported answer types include short and long text, yes/no, single select, multi-select, date, date/time, rich text, number, scale, email, phone, time, signature, file, and repeatable group
- Templates support configurable fill roles, required questions, conditional visibility, conditional required rules, option display styles, validation ranges, and help text
- Seeded templates support mid-year reviews, Mentor certification, Shift Lead certification, Coach Check-ins, and custom forms
- Certification submissions are linked to the existing Mentor and Shift Lead certification history; legacy checklist data remains readable
- Employees can save drafts, resume them, submit responses, and view submitted responses as read-only
- Submitted answers retain a creation-time template snapshot so later wording or option changes do not rewrite historical responses
- File and signature answers use private, response-scoped object-storage references served through authenticated routes; raw base64 or public object URLs are not stored as response values
- A limited `roi_onboarding` shared form captures consent, signature, and service-provider details without replacing the existing legacy ROI onboarding flow or becoming a legal-document CMS

### 2.14 Profile Catalog & Support Configuration
**Priority: Medium**

- Administrators manage Support Information field labels, descriptions, order, and active/inactive status from the Profile Catalog
- Existing values are retained when a field is deactivated
- Administrators manage reusable contact relationship options; inactive options remain valid for existing contacts but are hidden from new edits
- Profile catalog values use bounded string lists for the current support-information fields, including interests, challenges, regulation strategies, and accommodations

---

## 3. Technical Requirements

### 3.1 Architecture

- **Frontend**: React + TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix UI, Lucide React icons
- **State**: React Context API (auth + global data), TanStack Query v5 (server state)
- **Routing**: wouter (client-side SPA)
- **Backend**: Express.js + Node.js + TypeScript (monolithic)
- **Database**: PostgreSQL on Neon (serverless) via @neondatabase/serverless WebSocket driver
- **ORM**: Drizzle ORM — schema-first, type-safe, additive migrations only
- **Validation**: Zod + drizzle-zod
- **Build**: Vite (frontend) + esbuild (backend), served on same port via Express

### 3.2 Database Schema (Production Tables)

**employees** — unified user + employee record  
id, name (legacy required), first_name, last_name, email, role, profile_image_url, is_active, has_system_access, password, last_login, date_of_birth, roi_status, roi_signed_at, roi_signature, roi_consent_type, roi_no_release_details, roi_guardian fields, has_service_provider, service_providers (jsonb), allergies (jsonb), emergency_contacts (jsonb), interests_motivators (jsonb), challenges (jsonb), regulation_strategies (jsonb), accommodations (jsonb), created_at, updated_at

**goal_templates**  
id, name, goal_statement, default_mastery_criteria, relative_target_duration, default_target_date, status, created_at, updated_at

**goal_template_steps**  
id, template_id (fk), step_order, step_description, is_required, timer_required, timer_type (none/required/optional), created_at

**development_goals**  
id, employee_id (fk), template_id (fk), title, description, start_date, target_end_date, status, mastery_achieved, mastery_date, consecutive_all_correct, created_at, updated_at

**goal_steps** — snapshot of template steps at assignment time  
id, goal_id (fk), step_order, step_description, is_required, created_at

**step_progress**  
id, development_goal_id (fk), goal_step_id (fk), employee_id (fk), date, outcome, notes, assessment_session_id (fk), status, documenter_user_id (fk), completion_time_seconds, timer_manually_entered, created_at, updated_at

**assessment_sessions**  
id, manager_id (fk), date, location, employee_ids (jsonb array), notes, status (draft/in_progress/completed/abandoned), locked_by (fk), locked_at, expires_at, taken_over_from, taken_over_at, created_at, updated_at

**assessment_summaries**  
id, employee_id (fk), assessment_session_id (fk), date, summary, created_at, updated_at

**Forms & Reviews tables**
- form_templates — named, versioned templates with fill-role settings
- form_sections — ordered template sections
- form_questions — stable-key questions, configuration, conditions, and status
- form_response_sets — employee-scoped draft/submitted response containers
- form_answers — structured answers with creation-time snapshots

**Support, access, and communication tables**
- coach_assignments — links coaches to their Super Scoopers
- guardian_relationships — links guardians to their loved ones
- guardian_notes — compatibility storage for guardian notes
- profile_notes — unified profile notes and timeline entries
- account_invitations — email-based setup tokens
- coach_checkins — structured visit notes
- coach_files — uploaded documents
- coach_notes — rich text notes per scooper
- promotion_certifications — mentor/shift lead certs
- employee_contacts — unified contact management
- role_permissions — configurable feature × role permission matrix
- profile_field_definitions — administrator-managed Support Information fields
- option_lists / option_list_items — reusable contact relationship options
- videos, goal_template_videos, goal_template_step_videos — training video links and placement
- employee_reviews — employee review records

### 3.3 Key File Locations

| What | Where |
|------|-------|
| Database schema + types | shared/schema.ts |
| All API routes | server/routes.ts |
| Storage interface | server/storage.ts |
| Auth + apiRequest | client/src/lib/auth.ts |
| Global data context | client/src/contexts/DataContext.tsx |
| Employee profile page | client/src/components/EmployeeDetail.tsx |
| Assessment UI | client/src/components/EmployeeProgress.tsx |
| Permission hook | client/src/hooks/usePermissions.ts |
| Client-side cache | client/src/lib/apiCache.ts |
| Forms & Reviews UI | client/src/components/FormsAndReviews.tsx |
| Employee form responses | client/src/components/EmployeeCustomFormsCard.tsx |
| Certification form flow | client/src/components/CertificationTemplateFlow.tsx |
| Shared notes timeline | client/src/components/NotesFeed.tsx |
| Profile Catalog UI | client/src/components/ProfileCatalogManager.tsx |
| App router | client/src/App.tsx |

### 3.4 Performance Requirements
- Initial data load uses parallel requests (Promise.all) — 5 concurrent instead of sequential
- Step progress and assessment summaries deferred and loaded in the background
- Batch endpoint for assessment history eliminates N+1 fetching
- Client-side caching prevents redundant re-fetches within a session
- Request deduplication prevents duplicate concurrent GET requests
- Responsive design — tested at 375px minimum width (mobile), tablet, and desktop

### 3.5 Security Requirements
- Every API endpoint requires authentication middleware (authenticateToken)
- Role-restricted endpoints use requireRole() or requirePermission() middleware
- Job Coach endpoints verify coach-to-employee assignment before allowing access
- Guardian endpoints verify guardian-to-scooper relationship
- Form response reads, writes, and private assets are scoped to the employee response and authorized profile access
- Form file and signature objects are private; generic object access to form-response paths is blocked
- All DELETE endpoints protected by role and ownership checks
- No bulk-delete operations on core tables

### 3.6 Data Safety Rules (non-negotiable)
- Schema changes must be additive only — no dropping or renaming columns, no breaking type changes
- Production has real employee data since September 2025; data loss is not acceptable
- Legacy employees.name field must always be populated (set to first_name + last_name)
- All new columns must be nullable or have a safe default
- Run npm run db:push before every publish; stop if any data-loss warning appears

---

## 4. User Experience Requirements

### 4.1 Design Standards
- Consistent rounded corner styling (rounded-xl) across all cards and inputs
- Blue-600 primary action buttons; green-600 for start/positive actions; amber-600 for join/attention states
- Gray-100 page backgrounds, white card surfaces, gray-200 borders
- Lucide React icons for all UI actions and indicators

### 4.2 Usability
- Minimal training required for shift managers — assessment flow is self-evident
- Mobile-first responsive design: sidebar collapses to a drawer on mobile, touch targets sized appropriately
- Step outcomes selectable with a single tap
- Presence indicator shows who else is documenting without disrupting the flow
- Timer hidden by default to reduce cognitive load; one tap to expand

### 4.3 Accessibility
- Sufficient color contrast on all text
- Keyboard navigation support
- Screen reader compatible component primitives (Radix UI)

---

## 5. Business Rules

### 5.1 Mastery Criteria
- Default: 3 consecutive assessments with all required steps marked Correct = mastered
- Verbal Prompt, Incorrect, and N/A outcomes reset the consecutive counter
- N/A does not penalize but does not count toward mastery
- Mastery is recalculated automatically on every assessment submission
- Mastery date is recorded when the threshold is crossed

### 5.2 Access Control Summary

| Role | Employees | Assessments | Goals | Coach Features | Guardian Features | Admin Settings |
|------|-----------|-------------|-------|---------------|-------------------|----------------|
| Administrator | All | All | All | All | All | Yes |
| Shift Lead | All | Own + join | All | View | View | No; form access is template/permission scoped |
| Assistant Manager | All | Own + join | All | View | View | No |
| Job Coach | Assigned only | Own only | View assigned | Check-ins, notes, files | No | No |
| Guardian | Linked only | View only | View linked | No | Shared notes when permitted | No |
| Super Scooper | Own profile | No | View own | No | Limited ROI form only where explicitly enabled | No |

### 5.3 Assessment Session Rules
- One active session per employee at a time
- Any authorized user can join an existing session (collaborative model)
- Session owner renews the 30-minute lock; joiners write step progress without renewing
- Administrators can take over an active session and receive a renewed 30-minute lock
- Sessions auto-expire and are marked abandoned after 30 minutes with no renewal
- Step progress is immutable once submitted (status: submitted)

### 5.4 Data Deletion Rules
- Only the data creator or an Administrator can delete records
- Core tables (employees, development_goals, step_progress, goal_templates, assessment_sessions) use soft deletes (status flags) wherever possible
- Hard deletes only on peripheral records (coach files, invitations, certifications)
- Form templates, questions, sections, and options are deactivated or archived rather than removed when history depends on them
- Historical form responses remain readable from their saved template snapshots

---

## 6. Success Metrics

| Metric | Target |
|--------|--------|
| Shift Lead adoption | 100% of shifts documented digitally |
| Assessment completion rate | All active goals tracked each shift |
| Coach engagement | Regular check-ins and notes for all assigned scoopers |
| Mastery velocity | Measurable reduction in time-to-competency |
| Data accuracy | Zero lost or corrupted records in production |
| ROI compliance | 100% of active Super Scoopers with signed ROI on file |

---

## 7. Out of Scope (Current Version)
- Employee self-service portal
- Push notifications or real-time WebSocket updates
- Scheduling or shift calendar integration
- Payroll system integration
- Location administration, scheduling, and calendar integration; assessments currently use a fixed location list
- Native mobile app (web-responsive only)
- Automated goal recommendations

---

## 8. Current Production Baseline (as of July 2026)
- 57 employees
- 85 goal templates with 1,377 steps
- 24 active development goals
- 430 step progress records
- 81 assessment sessions
- Live since September 2025
- Counts are operational baseline figures and should be refreshed separately from this feature requirements document.

---

*Document Version: 2.1*
*Last Updated: August 28, 2026*
*Status: Live in production — collaborative assessments, ROI compliance, configurable permissions, Forms & Reviews, profile catalog, shared notes, and coach/guardian features are shipped*

# Product Requirements Document
## Unique Pathway — Employee Development & Shift Management System

### Executive Summary
Unique Pathway is a comprehensive employee development and shift management application designed for a supported employment program. The system enables shift leads, managers, job coaches, and guardians to track employee ("Super Scooper") progress on development goals through structured step-by-step assessments during work shifts.

---

## 1. Product Overview

### 1.1 Purpose
To provide a digital solution for tracking employee skill development, managing work shifts, and documenting progress toward mastery of job-related competencies in a supported employment environment.

### 1.2 Target Users
- **Administrators**: Manage employees, create goal templates, oversee system operations, configure permissions
- **Shift Leads**: Track employee progress during shifts, document outcomes
- **Assistant Managers**: Track employee progress during shifts, document outcomes
- **Job Coaches**: Access and document progress for assigned scoopers only
- **Guardians**: View progress for assigned scoopers only (read-only)
- **Super Scoopers**: Employees being tracked, minimal system access

### 1.3 Business Goals
- Standardize employee training and development processes
- Improve employee skill tracking and documentation
- Enable data-driven decisions about employee readiness and performance
- Reduce training inconsistencies across different shifts and managers
- Support compliance with ROI (Release of Information) requirements

---

## 2. Functional Requirements

### 2.1 User Management
**Priority: High**

**User Authentication**
- JWT-based authentication with bcrypt password hashing
- Role-based access control (6 roles: Administrator, Shift Lead, Assistant Manager, Job Coach, Guardian, Super Scooper)
- Session management with idle timeout (30min) and absolute timeout (8h)
- Account invitation system with single-use setup tokens

**User Administration (Admin Only)**
- Create, edit, and manage user accounts
- Assign roles and permissions via configurable permissions matrix
- Activate/deactivate user accounts
- Send account setup invitations via email link

### 2.2 Employee Management
**Priority: High**

**Employee Profiles**
- Basic information (first name, last name, email)
- Emergency contact information (multiple contacts supported)
- Allergy and dietary restriction tracking
- Personal motivators and engagement preferences
- Challenges and regulation strategies
- Employment status and role information
- Date of birth
- Profile images (uploaded via object storage)

**Employee Operations**
- Create new employee profiles
- Edit existing employee information
- View comprehensive employee details
- Archive/deactivate employees
- Bulk upload employees via CSV

**ROI Compliance**
- Release of Information consent management
- Guardian signature capture
- Consent type tracking (full release, limited release, no release)
- Guardian contact information collection

### 2.3 Goal Template System
**Priority: High**

**Template Management**
- Create reusable goal templates with structured steps
- Define step descriptions and success criteria
- Order steps in logical sequences
- Edit and update existing templates
- Archive templates (soft delete)
- Bulk upload templates via CSV

**Template Properties**
- Goal statement
- Default mastery criteria
- Relative target duration
- Step-level timer support (countdown or count-up)
- Required vs optional steps

### 2.4 Development Goal Assignment
**Priority: High**

**Goal Assignment Process**
- Assign goal templates to specific employees
- Set target completion dates
- Define mastery criteria (default: 3 consecutive successful completions)
- Track assignment history

**Goal Tracking**
- Monitor active goals per employee
- View progress toward mastery
- Track completion rates and timelines
- Goal status lifecycle: active → mastered/paused

### 2.5 Shift Management & Assessment
**Priority: High**

**My Shift Workflow**
- Search, pin, and build a working list of employees for the shift
- Working list persisted in sessionStorage
- Navigate to individual employee profiles for assessment

**Assessment Sessions**
- Advisory lock-based session creation (prevents concurrent conflicts)
- Location selection (from predefined locations list)
- Step-by-step evaluation interface
- Multiple outcome options (Correct, Verbal Prompt, Physical Prompt, N/A)
- Note-taking capability for each step
- Timer support (countdown and count-up) per step
- Draft save and final submission workflow
- Session locking with automatic expiry

**Mastery Tracking**
- Automatic detection of mastery achievement
- Consecutive success tracking
- Goal completion status updates
- Progress visualization per goal

### 2.6 Coach & Guardian Features
**Priority: High**

**Coach Assignments**
- Admin/Manager assigns coaches to scoopers
- Coaches see only their assigned scoopers via "My Scoopers" page
- Coach check-in forms with structured visit documentation
- Rich text notes (TipTap editor)
- File upload/download per scooper

**Guardian Relationships**
- Admin/Manager links guardians to scoopers
- Guardians see only their linked scoopers via "My Loved Ones" page
- Read-only access to scooper progress

### 2.7 Configurable Permissions
**Priority: Medium**

**Admin Permissions Matrix**
- Feature × Role grid (Shift Lead, Assistant Manager, Job Coach, Guardian)
- Toggle View/Modify/Delete per feature per role
- Administrator always has full access (locked, not configurable)
- Validation: Modify/Delete require View to be enabled
- Backend enforcement via `requirePermission` middleware
- Frontend enforcement via `usePermissions` hook

### 2.8 Reporting & Analytics
**Priority: Medium**

**Dashboard Overview**
- Key performance metrics
- Employee progress overview
- Assessment session history

**Progress Reports**
- Individual employee progress
- Goal completion rates
- Session history and trends

---

## 3. Technical Requirements

### 3.1 Architecture
- **Frontend**: React with TypeScript, Vite build system, Tailwind CSS
- **Backend**: Node.js with Express.js, Pino structured logging
- **Database**: PostgreSQL with Drizzle ORM (Neon serverless)
- **Authentication**: JWT with bcrypt, rate-limited login
- **Object Storage**: Replit GCS sidecar (environment-specific)

### 3.2 Data Models
See `shared/schema.ts` for the authoritative schema. Key tables:
- `employees` — profiles, personal info, ROI data
- `goal_templates` / `goal_template_steps` — reusable goal structures
- `development_goals` / `goal_steps` — employee-specific goal instances
- `step_progress` — individual step outcomes per session
- `assessment_sessions` / `assessment_summaries` — session metadata
- `coach_assignments` / `guardian_relationships` — access scoping
- `account_invitations` — user onboarding tokens
- `coach_checkins` / `coach_files` / `coach_notes` — coach documentation
- `promotion_certifications` — mentor/shift lead certs
- `role_permissions` — configurable feature permissions

### 3.3 Performance Requirements
- Page load times under 3 seconds
- Responsive design for tablet and mobile use (375px minimum)
- Concurrent user support (multiple shift leads documenting simultaneously)
- Advisory locks for safe concurrent session creation

### 3.4 Security Requirements
- JWT authentication on all API endpoints
- Role-based access control with 6 distinct roles
- Field allowlisting on all write endpoints (prevent mass assignment)
- Password hashing with bcrypt (12 salt rounds)
- Sensitive fields stripped from all API responses
- Rate limiting on login (10/15min) and general API (200/15min)
- Input validation via Zod schemas
- XSS prevention via HTML sanitization on rich text content

---

## 4. User Experience Requirements

### 4.1 Design Standards
- Consistent rounded corner styling (rounded-xl)
- Professional color scheme: blue-600 primary, gray-100 backgrounds
- Intuitive navigation with role-based sidebar
- Responsive design with mobile sidebar drawer

### 4.2 Usability Requirements
- Minimal training required for shift leads and coaches
- Clear visual indicators for progress and status
- Easy-to-understand assessment interface
- Quick access to frequently used functions
- Toast notifications for all actions (no browser alert/confirm dialogs)

### 4.3 Accessibility
- Keyboard navigation support for all interactive elements
- ARIA roles on modals and tab interfaces
- Focus trapping on modals
- Sufficient color contrast (WCAG AA)
- Touch targets minimum 44x44px for mobile

---

## 5. Business Rules

### 5.1 Mastery Criteria
- Goals are considered mastered after 3 consecutive successful completions (configurable per goal)
- "Correct" outcomes count toward mastery
- "Verbal Prompt", "Physical Prompt", and "N/A" outcomes reset the consecutive counter
- Mastery status is automatically calculated and displayed

### 5.2 Access Control
- Administrators can manage all system functions
- Shift Leads and Assistant Managers can track progress and manage shifts for all scoopers
- Job Coaches can only access their assigned scoopers (enforced server-side via coach_assignments)
- Guardians can only view their linked scoopers (enforced server-side via guardian_relationships)
- Super Scoopers have minimal access (view own profile)
- Feature-level permissions configurable by Administrators via the permissions matrix

### 5.3 Data Integrity
- All schema changes must be additive only (see DEVELOPMENT_GUIDELINES.md)
- Production data has existed since September 2025 — no tolerance for data loss
- Active sessions use advisory locks to prevent concurrent conflicts
- Soft deletes preferred for core business data

---

## 6. Success Metrics

### 6.1 User Adoption
- All shift leads and coaches actively using the system
- Regular goal tracking during all shifts
- Consistent data entry and documentation

### 6.2 Operational Efficiency
- Reduced time spent on manual progress tracking
- Improved consistency in employee development
- Better visibility into training needs and gaps

### 6.3 Employee Development
- Measurable progress toward goal mastery
- Reduced time to competency for new employees
- Improved employee satisfaction through structured development

---

## 7. Future Enhancements

### 7.1 Phase 2 Features
- Employee self-service portal
- Advanced reporting and analytics
- Integration with scheduling systems
- Mobile-native app for shift managers
- React Query migration for data fetching (replace DataContext raw fetch)
- Route module extraction (split monolithic routes.ts)
- Component refactoring (break up EmployeeDetail monolith)

### 7.2 Advanced Capabilities
- Automated goal recommendations
- Performance trend analysis
- Multi-location support
- Offline-capable assessment mode

---

*Document Version: 2.0*
*Last Updated: March 2026*
*Status: Active Development*

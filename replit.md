# Overview

Golden Scoop is a comprehensive employee development and goal documentation application designed for an ice cream shop. The system enables managers and administrators to track employee progress on development goals through structured step-by-step assessments. Key features include employee profile management, goal template creation, goal documentation sessions, and real-time progress tracking with mastery criteria based on consecutive successful completions.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## Phase 7: ROI Compliance Flow (February 2026)
- **Full ROI Document**: OnboardingVerify.tsx rebuilt with complete legal text from The Golden Scoop Authorization For Exchange of Information document
- **Consent Toggles**: Radio selection for "Release of all information" vs "I do NOT authorize the release of these records" with text area for specifics
- **Canvas Signature Pad**: Touch/stylus-enabled signature canvas for mobile and desktop, with clear button
- **Guardian Fields**: Conditional "Authorized Representative" section (Printed Name, Address, City/State/Zip, Phone, Relationship) shown only for Guardian role
- **Schema Updates**: New fields on employees table: roi_signature, roi_consent_type, roi_no_release_details, roi_guardian_name/address/city_state_zip/phone/relationship
- **Backend Updates**: POST /api/onboarding/sign-roi accepts and stores signature image data, consent choice, and guardian details
- **DOB Verification Gate**: Identity verification (DOB check) required before ROI form is visible
- **Mobile-Responsive**: Thumb-friendly buttons, responsive text sizes, touch-optimized signature pad

## Phase 6: Promotion Certifications (February 2026)
- **New Database Table**: `promotion_certifications` tracks employee certifications with type, date, score, passing criteria, checklist results, and certifier
- **Two Certification Types**: Mentor (32 items, 84% passing) and Shift Lead (56 items across 4 categories, 90% passing)
- **Employee Form Integration**: New "Promotion Certifications" section in employee edit form with full checklist UI, auto-scoring, and pass/fail tracking
- **Employee Table Badges**: Star icon (amber) for Mentor certified, Award icon (blue) for Shift Lead certified next to employee names
- **API Endpoints**: GET/POST/DELETE /api/certifications with role-based access control

## Phase 5: Design System Standardization (February 2026)
- **Reusable Tabs Component**: Pill-style tabs with blue filled active state, used across BulkUpload, GoalTemplates, AssignmentsManagement
- **Reusable Modal Component**: Standardized sizes (sm/md/lg/xl), consistent backdrop/close/padding, used across GoalTemplates form, AssessmentDetailsModal, SessionWarning
- **Reusable Button Component**: Variants (primary/secondary/danger/ghost) and sizes (sm/md/lg)
- **FormInput/SelectInput Components**: Standardized px-4 py-3 rounded-xl base styling
- **Design Tokens**: Two-tier border-radius (rounded-2xl containers, rounded-xl cards/inputs), consistent card styling (bg-white rounded-xl shadow-sm border border-gray-200)
- **Enhanced Mobile Responsiveness**: Responsive padding (p-3 sm:p-6), text sizes (text-lg sm:text-2xl), stat grids (grid-cols-2 lg:grid-cols-4) across all pages

## Phase 4: Guardian Experience & Mobile Responsiveness (February 2026)
- **My Loved Ones Page**: New dedicated page for Guardians showing only their linked family members with stats cards (Heart icon in sidebar)
- **Guardian Backend Data Scoping**: /api/employees, /api/development-goals, /api/step-progress all filter by guardian_relationships when user is Guardian
- **Mobile-Responsive Design**: All screens optimized for mobile (sidebar drawer, responsive grids, touch-friendly spacing)
- **Sidebar Mobile Drawer**: Hamburger menu opens sidebar as overlay with backdrop on mobile devices

## Phase 3: Security Hardening & Invitation System (February 2026)
- **Role Guards**: POST/PUT/DELETE endpoints blocked for Job Coach and Guardian roles (read-only access enforced)
- **Account Invitations**: Token-based invitation system for onboarding Job Coaches and Guardians
- **Account Setup Page**: Mobile-friendly password creation form accessed via invitation link (?setup=TOKEN)
- **Admin Invitation UI**: Generate copyable invitation links from employee detail view

## Phase 2: Job Coach Scoped Experience (February 2026)
- **My Scoopers Page**: New dedicated page for Job Coaches showing only their assigned Super Scoopers with stats cards
- **Backend Data Scoping**: /api/employees, /api/development-goals, /api/step-progress all filter by coach assignments when user is Job Coach
- **Read-Only Profile View**: Job Coaches can view scooper profiles/goals/progress but cannot edit, assign goals, or archive
- **Dashboard Scoping**: Dashboard metrics automatically reflect only assigned scoopers for Job Coach role
- **Branding**: Sign-in page renamed to "My Unique Pathway" with "The Golden Scoop" as subtitle

## Phase 1: Role Architecture Expansion (February 2026)
- **New Roles**: Job Coach and Guardian added alongside existing roles
- **Coach Assignments**: Many-to-many relationship between Job Coaches and Super Scoopers (coach_assignments table)
- **Guardian Relationships**: Many-to-many relationship between Guardians and Super Scoopers (guardian_relationships table)
- **Assignments Admin Page**: Admin UI for managing coach/guardian assignments
- **Role-Based API Scoping**: Coach/guardian endpoints enforce identity-based access (coaches see only own assignments, etc.)

## Goal Progress Display (October 2025)
- Percentage display inline with consecutive correct count (format: "2/3 (67%)")

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Component-based UI using functional components and hooks
- **Vite Build System**: Fast development server with hot module replacement
- **Tailwind CSS**: Utility-first styling with shadcn/ui component library
- **Context API State Management**: AuthContext for authentication and DataContext for application state
- **Single Page Application**: Client-side routing handled through component state switching

## Backend Architecture
- **Express.js REST API**: Node.js server with TypeScript support
- **Monolithic Structure**: Single server handling all API endpoints
- **In-Memory Storage Fallback**: MemStorage class for development when database unavailable
- **Session-less Authentication**: Demo authentication without persistent sessions
- **File-based Organization**: Separate modules for database, routes, and storage abstractions

## Database Layer
- **Drizzle ORM**: Type-safe database queries with schema-first approach
- **PostgreSQL Support**: Configured for Neon Database with connection pooling
- **Schema Management**: Centralized schema definitions with automatic migrations
- **Relational Design**: Normalized tables for users, employees, goals, templates, and progress tracking

## Data Models
- **Users**: Authentication and role-based access (admin, shift_manager)
- **Employees**: Profile management with support information (allergies, emergency contacts, motivators)
- **Goal Templates**: Reusable goal structures with ordered steps
- **Development Goals**: Employee-specific goal instances with progress tracking
- **Shift Management**: Active shift tracking with employee assignments
- **Progress Tracking**: Step-level outcomes (correct, verbal_prompt, n/a) with date stamps
- **Assessment Sessions**: Session-based goal documentation with user-specific locking to prevent editing conflicts

## Session Locking System
- **User-Specific Locking**: Assessment sessions lock employees to prevent multiple managers from documenting the same employee simultaneously
- **Lock Fields**: locked_by (manager ID), locked_at (timestamp), expires_at (30-minute expiry from creation)
- **Status Tracking**: Sessions have status enum (draft, in_progress, completed, abandoned)
- **Proactive Conflict Detection**: Frontend checks for locks before creating sessions and displays manager names holding locks
- **Lock Release**: Locks released when session is completed, abandoned, or when employees are removed from active session
- **Dynamic Employee List Updates**: Managers can add/remove employees during active sessions; removed employees are automatically unlocked
- **Implicit Lock Mechanism**: Employee locks are implicit - an employee is locked if they appear in any active session's employee_ids array
- **Bulk Upload Exception**: CSV imports create sessions with status='completed' and bypass locking mechanism
- **Abandoned Session Handling**: Sessions with status 'abandoned' or 'completed' are filtered out when loading active sessions; attempting to update an abandoned session creates a new session instead

### Race Condition Prevention
- **PostgreSQL Advisory Locks**: Session creation uses `pg_advisory_xact_lock()` to serialize concurrent access
- **Transaction-Scoped**: Locks automatically released when database transaction completes
- **Deadlock Prevention**: Employee IDs sorted alphabetically before acquiring locks to ensure consistent lock ordering
- **Atomic Operations**: Lock check and session creation wrapped in database transaction for atomicity
- **Conflict Handling**: Concurrent attempts return HTTP 409 with details about conflicting manager and locked employees

## Authentication & Authorization
- **Role-Based Access Control**: Admin and shift manager roles with different permissions
- **Demo Authentication**: Hardcoded credentials for development and testing
- **Context-Based State**: React context manages authentication state across components
- **Route Protection**: Component-level access control based on user roles

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **@neondatabase/serverless**: WebSocket-based database driver for edge compatibility

## UI Framework & Styling
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **shadcn/ui**: Pre-built accessible React components built on Radix UI primitives
- **Radix UI**: Unstyled accessible component primitives (dialogs, dropdowns, forms)
- **Lucide React**: Consistent icon library for UI elements

## Development Tools
- **Vite**: Fast build tool with TypeScript support and development server
- **Drizzle Kit**: Database migration and schema management tools
- **esbuild**: Fast JavaScript bundler for production builds
- **tsx**: TypeScript execution for development server

## Data Management
- **Drizzle ORM**: Type-safe ORM with PostgreSQL dialect support
- **Zod**: Runtime type validation and schema parsing
- **TanStack Query**: Server state management and caching (installed but not actively used)

## Additional Libraries
- **date-fns**: Date manipulation and formatting utilities
- **class-variance-authority**: Dynamic CSS class composition
- **clsx**: Conditional CSS class utilities
- **connect-pg-simple**: PostgreSQL session store (available for future session management)

# Production Safety & Monitoring

## Structured Logging
- **Pino Logger**: JSON-structured logging with contextual metadata throughout critical workflows
- **Session Creation**: Logs manager ID, employee IDs, location, lock conflicts with full context
- **Goal Documentation**: Tracks step progress submission, mastery calculations, consecutive counts
- **Bulk Imports**: Captures upload details, row processing stats, validation errors, affected entities
- **Error Context**: All errors logged with session IDs, employee IDs, manager IDs for debugging

## Concurrency Control
- **Advisory Locks**: PostgreSQL transaction-scoped advisory locks prevent race conditions in session creation
- **Serialization**: Concurrent requests for same employees processed sequentially via lock contention
- **Tested**: Automated concurrency tests verify one request succeeds (200) while concurrent attempts get conflict (409)
- **No Duplicates**: Lock mechanism guarantees only one active session per employee at any time

## Critical Workflows Protected
1. **Assessment Session Creation**: Transaction + advisory locks prevent duplicate active sessions
2. **Assessment Session Updates**: Dynamic employee list modifications with automatic lock release for removed employees
3. **Step Progress Submission**: Validated with mastery calculation logging
4. **Bulk CSV Import**: Comprehensive logging of rows processed, errors, entities affected
5. **Lock Acquisition**: Full audit trail of who locked which employees and when

## Multi-User Readiness
- System tested for concurrent session creation with proper conflict handling
- Advisory lock implementation prevents data corruption under simultaneous access
- Structured logs enable production debugging and audit trail
- Ready for multi-user testing phase before company-wide rollout
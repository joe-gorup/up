# Overview

Unique Pathway is an employee development and goal documentation application designed for a supported employment program. It enables managers, coaches, and guardians to track employee ("Super Scooper") progress on development goals through structured, step-by-step assessments. The system includes employee profile management, goal template creation, goal documentation sessions, real-time progress tracking with mastery criteria, coach check-ins, and configurable role-based permissions. The project aims to streamline employee development, enhance tracking capabilities, and improve compliance within the organization.

# User Preferences

Preferred communication style: Simple, everyday language.

# Development Guidelines

**IMPORTANT: Read `DEVELOPMENT_GUIDELINES.md` before making any changes.** This file contains critical rules for data safety, security, schema changes, deployment, and coding standards that ALL developers and AI tools must follow. Key points:
- All schema changes must be additive only (no dropping/renaming columns)
- Production has real data since September 2025 that must be preserved
- Always populate the legacy `employees.name` field when creating/updating employees
- Run `npm run db:push` and verify no destructive warnings before publishing
- Follow role-based access control patterns for all new endpoints
- NEVER pass `req.body` directly to `db.insert()` — use field allowlisting
- NEVER return password hashes in API responses — use `stripSensitiveFields()`
- All HTML from rich text editors must be sanitized before rendering (use DOMPurify)

# System Architecture

## Frontend Architecture
- **Technology Stack**: React with TypeScript, Vite build system, Tailwind CSS for styling.
- **UI Components**: Reusable components in `client/src/components/ui/` (Modal, Tabs, Button, etc.). Do NOT redefine UI components locally in feature components.
- **State Management**: React Context API — `AuthContext` for authentication/session, `DataContext` for application data. There is NO React Query (`@tanstack/react-query`) in this project.
- **Data Fetching**: All API calls go through `apiRequest` from `client/src/lib/auth.ts`, which handles JWT auth headers and automatic 401 logout. Do NOT use raw `fetch` with manual auth headers.
- **Routing**: `wouter` for client-side routing (NOT react-router). Route definitions in `client/src/App.tsx`.
- **Application Type**: Single Page Application (SPA) with client-side routing.
- **Design System**: Standardized reusable components with consistent design tokens (rounded-xl borders, blue-600 primary, gray-100 backgrounds).
- **Mobile Responsiveness**: Enhanced mobile responsiveness across all pages, including a mobile sidebar drawer and touch-optimized elements.
- **Error Handling**: Use `useToast` hook for user-facing notifications. NEVER use `alert()`, `confirm()`, or `window.location.reload()`.
- **Loading States**: Use the shared `LoadingSpinner` component for all loading states.

## Backend Architecture
- **Technology Stack**: Express.js REST API with Node.js and TypeScript.
- **Structure**: Monolithic server with all routes in `server/routes.ts`.
- **Authentication**: JWT-based authentication via `authenticateToken` middleware in `server/auth.ts`. Tokens expire after 8 hours.
- **Authorization**: Role-Based Access Control (RBAC) with 6 roles: Administrator, Shift Lead, Assistant Manager, Job Coach, Guardian, Super Scooper. Use `requireRole()` for role checks and `requirePermission()` for feature-level permission checks.
- **Input Validation**: Use `pickAllowedFields()` with explicit allowlists for all write operations. Use Zod schemas from `shared/schema.ts` for runtime validation.
- **Sensitive Data**: Always use `stripSensitiveFields()` / `stripSensitiveFieldsArray()` before returning employee/user objects. Never return password hashes.
- **Rate Limiting**: `express-rate-limit` applied to login (10/15min) and general API (200/15min).
- **Logging**: Pino structured logging via `server/logger.ts`. Use `logger.info/warn/error` — never `console.log` in server code.
- **Concurrency Control**: PostgreSQL Advisory Locks prevent race conditions during assessment session creation.
- **Object Storage**: Replit-specific GCS sidecar at `127.0.0.1:1106` (see `server/objectStorage.ts`). This only works in the Replit environment.

## Database Layer
- **ORM**: Drizzle ORM for type-safe database queries and schema management.
- **Database**: PostgreSQL via Neon Database serverless hosting with WebSocket connections.
- **Schema**: Defined in `shared/schema.ts`. All tables have Zod insert schemas, insert types, and select types.
- **Key Tables**: `employees`, `goal_templates`, `goal_template_steps`, `development_goals`, `goal_steps`, `step_progress`, `assessment_sessions`, `assessment_summaries`, `coach_assignments`, `guardian_relationships`, `account_invitations`, `coach_checkins`, `coach_files`, `coach_notes`, `promotion_certifications`, `role_permissions`.
- **Indexes**: Defined in `shared/schema.ts` — use existing indexes and add new ones for frequently queried columns.

## Key Features & Implementations
- **Goal Management**: Creation of goal templates, employee-specific goal instances, and step-by-step progress tracking with mastery criteria.
- **Assessment Sessions**: User-specific locking mechanism prevents concurrent documentation conflicts, with automatic lock expiry and release.
- **User Management**: Role-based access, account invitation system, and a dedicated setup page for new users.
- **Employee Features**: Comprehensive employee profiles, promotion certifications (Mentor, Shift Lead), and ROI compliance flow with legal text, consent toggles, and signature capture.
- **My Shift Workflow**: Shift Leads and Admins use a "My Shift" page to search, pin, and build a working list of employees for the day (persisted in session). Assessments are conducted from individual employee profiles.
- **Coach & Guardian Experience**: Dedicated "My Scoopers" (fixed assigned list, no search) and "My Loved Ones" pages with scoped data views for Job Coaches and Guardians, respectively.
- **Profile-Based Assessments**: Goal assessment (EmployeeProgress) is embedded directly in EmployeeDetail profiles with location selection.
- **Coach Notes & Files**: Rich text editing (TipTap) for coach notes and file upload/download capabilities with access control.
- **Configurable Permissions**: Admin-only Permission Settings page with matrix grid (features × roles). Toggle View/Modify/Delete per feature per role. Backend `requirePermission` middleware and frontend `usePermissions` hook for enforcement.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **@neondatabase/serverless**: WebSocket-based database driver.

## UI Framework & Styling
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

## Development Tools
- **Vite**: Fast build tool.
- **Drizzle Kit**: Database migration and schema management.
- **esbuild**: Fast JavaScript bundler.
- **tsx**: TypeScript execution.

## Data Management
- **Drizzle ORM**: Type-safe ORM.
- **Zod**: Runtime type validation.

## Additional Libraries
- **date-fns**: Date manipulation utilities.
- **bcrypt**: Password hashing.
- **jsonwebtoken**: JWT token generation and verification.
- **pino**: Structured logging.
- **express-rate-limit**: API rate limiting.
- **TipTap**: Rich text editor for coach notes.

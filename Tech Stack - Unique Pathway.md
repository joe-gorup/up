# Tech Stack — Unique Pathway by The Golden Scoop

*Last updated: July 2026*

---

## Overview

Unique Pathway is a web-based employee development and goal-tracking application built as a Single Page Application (SPA) with a REST API backend and a cloud-hosted PostgreSQL database.

---

## Frontend

| Layer | Technology | Purpose |
|---|---|---|
| Framework | **React 18** + **TypeScript** | UI rendering and type safety |
| Build Tool | **Vite** | Fast dev server and production bundler |
| Styling | **Tailwind CSS** | Utility-first CSS |
| Component Library | **shadcn/ui** + **Radix UI** | Accessible, pre-built UI components |
| Icons | **Lucide React** | Icon set |
| Routing | **wouter** | Lightweight client-side routing |
| Data Fetching | **TanStack Query v5** | Server state, caching, background refetch |
| Form Handling | **react-hook-form** + **zod** | Form state and validation |
| Date Utilities | **date-fns** | Date formatting and manipulation |
| CSS Utilities | **clsx**, **class-variance-authority** | Conditional class composition |

**Application type:** Single Page Application (SPA) — the frontend and backend are served from the same Express server on the same port.

---

## Backend

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | **Node.js** + **TypeScript** | Server runtime and type safety |
| Framework | **Express.js** | REST API routing and middleware |
| Bundler | **esbuild** via **tsx** | TypeScript execution in development |
| Authentication | Custom token-based (JWT) | Session-less auth with invitation system |
| Authorization | Custom RBAC middleware | Role-based access control per endpoint |
| Concurrency | **PostgreSQL Advisory Locks** | Prevents race conditions in assessment sessions |
| Logging | **pino** | Structured JSON logging |

**Architecture:** Monolithic — a single Express server handles both the API and serves the Vite-built frontend.

---

## Database

| Layer | Technology | Purpose |
|---|---|---|
| Database | **PostgreSQL** | Primary data store |
| Hosting | **Neon Database** | Serverless PostgreSQL with connection pooling |
| Driver | **@neondatabase/serverless** | WebSocket-based Neon-native driver |
| ORM | **Drizzle ORM** | Type-safe queries and schema definition |
| Schema Management | **Drizzle Kit** | Schema migrations (`npm run db:push`) |
| Validation | **drizzle-zod** + **Zod** | Schema-derived runtime validation |

---

## Roles & Access Control

Six user roles with configurable permissions managed via an admin settings page:

| Role | Access Level |
|---|---|
| Administrator | Full access to all features |
| Assistant Manager | Broad access; configurable |
| Shift Lead | Shift-focused; configurable |
| Job Coach | Scoped to assigned Super Scoopers |
| Guardian | Scoped to linked family member(s) |
| Super Scooper | Personal dashboard only |

---

## Key Data Tables

| Table | Description |
|---|---|
| `employees` | All users and employees |
| `development_goals` | Employee-specific goal instances |
| `goal_templates` | Reusable goal definitions with steps |
| `step_progress` | Per-step assessment outcomes |
| `assessment_sessions` | Tracks active and completed sessions with locks |
| `coach_notes` | Rich-text notes from Job Coaches |
| `coach_files` | File attachments on employee profiles |
| `coach_checkins` | Coach session check-in records |
| `employee_contacts` | Unified contact management |
| `promotion_certifications` | Mentor and Shift Lead certifications |
| `employee_reviews` | Mid-year and annual performance reviews |
| `role_permissions` | Configurable feature permissions per role |

---

## Hosting & Deployment

| Component | Platform |
|---|---|
| Application hosting | **Replit** (`.replit.app` domain) |
| Database | **Neon Database** (serverless PostgreSQL) |
| Environment variables | Replit Secrets (`DATABASE_URL`, etc.) |
| Deployment method | Replit publish → production environment |

---

## Development Toolchain

| Tool | Purpose |
|---|---|
| `npm run dev` | Starts Express + Vite dev servers concurrently |
| `npm run db:push` | Pushes Drizzle schema changes to the database |
| `npm run build` | Builds frontend for production via Vite |
| TypeScript | End-to-end type safety (shared types in `shared/schema.ts`) |

---

## Notable Architectural Decisions

- **Shared schema** — `shared/schema.ts` defines Drizzle table definitions, Zod insert schemas, and TypeScript types used by both the frontend and backend, ensuring a single source of truth.
- **Additive-only schema changes** — Production has live data since September 2025. All schema changes must add columns or tables; dropping or renaming is not permitted without a migration plan.
- **Client-side caching** — `apiCache.ts` prevents redundant re-fetching of employee relationships, contacts, notes, and assessment history within a browser session.
- **Request deduplication** — Concurrent identical GET requests are collapsed into one in-flight request.
- **Configurable permissions** — Feature access is not hardcoded. Administrators can toggle View / Edit / Delete per feature per role from a settings page, enforced by `requirePermission` middleware on the backend and `usePermissions` hook on the frontend.

# Overview

Golden Scoop is an employee development and goal documentation application designed for an ice cream shop. It enables managers and administrators to track employee progress on development goals through structured, step-by-step assessments. The system includes employee profile management, goal template creation, goal documentation sessions, and real-time progress tracking with mastery criteria. The project aims to streamline employee development, enhance tracking capabilities, and improve compliance within the organization.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
-   **Technology Stack**: React with TypeScript, Vite build system, Tailwind CSS for styling.
-   **UI Components**: Utilizes shadcn/ui and Radix UI for accessible, pre-built components.
-   **State Management**: React Context API for authentication and global application state.
-   **Application Type**: Single Page Application (SPA) with client-side routing.
-   **Design System**: Standardized reusable components (Tabs, Modals, Buttons, Form Inputs) with consistent design tokens (border-radius, card styling, padding).
-   **Mobile Responsiveness**: Enhanced mobile responsiveness across all pages, including a mobile sidebar drawer and touch-optimized elements.

## Backend Architecture
-   **Technology Stack**: Express.js REST API with Node.js and TypeScript.
-   **Structure**: Monolithic server architecture.
-   **Authentication**: Session-less authentication (demo credentials for development), with a token-based invitation system for user onboarding.
-   **Authorization**: Role-Based Access Control (RBAC) with roles including Administrator, Shift Manager, Job Coach, and Guardian, enforcing read-only access for Job Coach and Guardian roles on specific endpoints.
-   **Concurrency Control**: PostgreSQL Advisory Locks prevent race conditions during assessment session creation and ensure data integrity.

## Database Layer
-   **ORM**: Drizzle ORM for type-safe database queries and schema management.
-   **Database**: PostgreSQL, specifically configured for Neon Database for serverless hosting and connection pooling.
-   **Schema**: Normalized relational design for users, employees, goal templates, development goals, progress tracking, and assessment sessions.
-   **New Tables**: `coach_checkins`, `promotion_certifications`, `coach_notes`, `coach_files` for storing check-in notes, certification details, rich-text coach notes, and file attachments respectively.

## Key Features & Implementations
-   **Goal Management**: Creation of goal templates, employee-specific goal instances, and step-by-step progress tracking with mastery criteria.
-   **Assessment Sessions**: User-specific locking mechanism prevents concurrent documentation conflicts, with automatic lock expiry and release.
-   **User Management**: Role-based access, account invitation system, and a dedicated setup page for new users.
-   **Employee Features**: Comprehensive employee profiles, promotion certifications (Mentor, Shift Lead), and ROI compliance flow with legal text, consent toggles, and signature capture.
-   **Coach & Guardian Experience**: Dedicated "My Scoopers" and "My Loved Ones" pages with scoped data views for Job Coaches and Guardians, respectively.
-   **Coach Notes & Files**: Rich text editing for coach notes and file upload/download capabilities with access control.

# External Dependencies

## Database Services
-   **Neon Database**: Serverless PostgreSQL hosting.
-   **@neondatabase/serverless**: WebSocket-based database driver.

## UI Framework & Styling
-   **Tailwind CSS**: Utility-first CSS framework.
-   **shadcn/ui**: Pre-built React components.
-   **Radix UI**: Unstyled accessible component primitives.
-   **Lucide React**: Icon library.

## Development Tools
-   **Vite**: Fast build tool.
-   **Drizzle Kit**: Database migration and schema management.
-   **esbuild**: Fast JavaScript bundler.
-   **tsx**: TypeScript execution.

## Data Management
-   **Drizzle ORM**: Type-safe ORM.
-   **Zod**: Runtime type validation.

## Additional Libraries
-   **date-fns**: Date manipulation utilities.
-   **class-variance-authority**: Dynamic CSS class composition.
-   **clsx**: Conditional CSS class utilities.
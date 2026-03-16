---
name: frontend-design
description: Create and modify frontend interfaces for the Unique Pathway application. Use this skill when building or modifying web components, pages, dashboards, or UI elements within this project. Follows project-specific patterns, accessibility requirements, and design system conventions.
license: Complete terms in LICENSE.txt
---

This skill guides creation and modification of frontend interfaces within the Unique Pathway application. All code must follow the project's established patterns and design system.

The user provides frontend requirements: a component, page, or interface to build or modify. They may include context about the purpose, audience, or technical constraints.

## Before You Start

**Read `DEVELOPMENT_GUIDELINES.md`** — it contains security rules, frontend patterns, and code quality standards that override any defaults below.

## Project-Specific Technical Constraints

### Stack
- React with TypeScript (strict — no `as any`)
- Vite build system
- Tailwind CSS for styling
- `wouter` for routing (NOT react-router)
- `apiRequest` from `client/src/lib/auth.ts` for ALL API calls (NOT React Query, NOT raw fetch)
- `DataContext` and `AuthContext` for shared state
- `useToast` hook for notifications

### Design System
- **Borders**: `rounded-xl` on cards and containers
- **Primary color**: `blue-600` for buttons and accents
- **Backgrounds**: `gray-100` for page backgrounds, white for cards
- **Consistent spacing**: Follow existing component padding/margin patterns
- **Mobile first**: Test at 375px minimum width

### Component Rules
- Use existing components from `client/src/components/ui/` (Modal, Tabs, Button, LoadingSpinner, etc.)
- Do NOT redefine Button, Modal, or other UI primitives locally in feature components
- Components MUST NOT exceed ~500 lines — extract sub-components for larger features
- Avoid 50+ `useState` declarations — split the component or use `useReducer`
- Move hardcoded data arrays to constants files or the database

### Forbidden Patterns
- `alert()`, `confirm()`, `prompt()` — use `useToast` and `ConfirmDialog`/`Modal`
- `window.location.reload()` — refresh data via DataContext or re-fetch
- `console.log` in committed code — remove before committing
- `as any` type casts — define proper types
- `dangerouslySetInnerHTML` without DOMPurify sanitization
- `Date.now()` for generating IDs — use `crypto.randomUUID()`
- `JSON.parse(JSON.stringify())` for deep cloning — use `structuredClone()`
- Nested interactive elements (`<div onClick>` inside `<button>`)
- Duplicate component definitions (check `ui/` folder first)
- Manual `localStorage.getItem('golden-scoop-session')` — use `useAuth()` context

### Required Patterns
- All API calls through `apiRequest` (handles auth headers and 401 auto-logout)
- `LoadingSpinner` during data loading states
- `useToast` for all user-facing success/error messages
- `try/catch` around all `JSON.parse()` calls on external data (localStorage, sessionStorage, API)
- Proper loading, error, and empty states for every data-fetching view
- ARIA roles on modals (`role="dialog"`, `aria-modal="true"`) and tabs (`role="tablist"`, `role="tab"`, `role="tabpanel"`)
- Focus trapping and Escape key handling on modals
- Keyboard navigation (arrow keys) on tab components
- Unique `id` attributes when multiple instances of a component may render

## Accessibility Requirements

- All interactive elements must be keyboard accessible
- Use semantic HTML (`<button>` for actions, `<a>` for navigation)
- Add `aria-label` to icon-only buttons
- Ensure WCAG AA color contrast (4.5:1 for normal text, 3:1 for large text)
- Never use color alone to convey information
- Test with keyboard-only navigation

## Design Thinking

When creating new interfaces:
- **Purpose**: What problem does this interface solve? Who uses it? (Refer to the Role Reference in DEVELOPMENT_GUIDELINES.md)
- **Consistency**: Match existing app aesthetics — this is a workplace tool, not a marketing site. Prioritize clarity and usability over visual flair.
- **Mobile**: Managers and coaches use this on tablets and phones during shifts. Touch targets must be at least 44x44px.
- **Performance**: Avoid unnecessary re-renders. Don't fetch data the user hasn't navigated to yet.

## After Implementation

- Verify no `console.log` statements remain
- Verify no unused imports
- Verify proper loading, error, and empty states
- Verify mobile responsiveness at 375px
- Verify keyboard accessibility
- Verify all API calls use `apiRequest`

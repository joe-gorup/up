# Work packets — Cursor (Architect) → Replit (Implementer)

Paste one packet at a time into Replit. Do not implement from this repo’s Cursor Cloud agent unless product explicitly overrides the working model.

**Design locked:** `DESIGN_DECISIONS.md` · **Form spec:** `FORM_ENGINE_SPEC.md`

---

## Start here — recommended order

| Order | Packet | Status | Effort |
|-------|--------|--------|--------|
| 1 | PACKET-001 | ✅ **Done** (Joe, Aug 25) | ~1 hour |
| 2 | PACKET-002 | ✅ **Done** (Joe, Aug 25) | ~half day |
| 3 | PACKET-003A | ✅ **Done** (Joe, Aug 25) | multi-day |
| **3b** | **PACKET-003A-UX** | ✅ **Done** (Joe, Aug 28) | ~half day |
| **4** | **PACKET-003B** | ✅ Done — **repair:** PACKET-003B-FIX | multi-day |
| **4-fix** | **PACKET-003B-FIX** | ✅ **Done** (Joe, Aug 29) | ~half day |
| **6** | **PACKET-003C** | ✅ **Done** (Joe, Aug 29) | multi-day |
| 7 | PACKET-004 | **Ready — Allison data entry** | small |
| **8** | **PACKET-003D** | **Ready — do next (engineering)** | multi-day |

**Do next:** **PACKET-004** (Allison enters PDF mid-year in Reviews UI) + **PACKET-003D** (advanced form types).

### Packet numbering (locked — do not mix)

| Packet | What it is |
|--------|------------|
| **PACKET-004** | **Historical mid-year PDF data entry** — Allison (or optional Replit bulk import script). **Not** profile catalog. |
| **PACKET-007** | **Profile field catalog** — admin-configurable interests, challenges, accommodations labels, contact relationship options (`profile_field_definitions`, `option_lists`). **Later.** |

---

## PACKET-001 — T1: Manager Service Provider / Job Coach visibility

**Status:** ✅ Done (Joe, Aug 25)  
**Priority:** High (quick win)

### Goal
Shift Leads / Assistant Managers (e.g. Ali) can see **Service Provider** and **Job Coach(es)** on Super Scooper profiles without hunting for them.

### Confirm first (5 min)
1. Log in as Ali (Shift Lead).
2. Open a Super Scooper who has coaches and/or service providers on file.
3. Report:
   - **A)** Sections appear after clicking **View Details**, or  
   - **B)** Sections still missing even when expanded, or  
   - **C)** Something else (describe).

### If result is A (expected)
**Approach:** Expand “View Details” by default for staff roles that need those sections.

**Change:** In `client/src/components/EmployeeDetail.tsx`, replace:

```ts
const [showSupportExpanded, setShowSupportExpanded] = useState(user?.role === 'Administrator');
```

with:

```ts
const [showSupportExpanded, setShowSupportExpanded] = useState(
  ['Administrator', 'Shift Lead', 'Assistant Manager'].includes(user?.role || '')
);
```

**Schema:** none  
**Out of scope:** editing permissions for managers; moving sections out of the collapsible; accommodations (T2)

### Acceptance tests
1. As Shift Lead: open Super Scooper → Service Provider + Job Coach visible without clicking View Details.
2. As Administrator: behavior unchanged (still expanded).
3. As Job Coach / Guardian: no unintended expansion of sensitive staff-only edit affordances (view-only rules unchanged).

### Deploy
Pull branch → restart Replit app (no `db:push`).

### Report back
Result of confirm (A/B/C), diff summary, who tested.

---

## PACKET-002 — T2: Accommodations field (draft — issue after T1)

**Status:** ✅ Done (Joe, Aug 25)  
**Priority:** Medium

### Goal
Dedicated **Accommodations** list on Super Scooper profiles (tools / environmental supports), separate from Regulation Strategies.

### Approach (mirror Challenges / Regulation Strategies)
1. Add `accommodations` JSONB on `employees`, default `'[]'::jsonb` (additive only).
2. Allowlist field in `server/routes.ts` `EMPLOYEE_ALLOWED_FIELDS`.
3. Map in `client/src/contexts/DataContext.tsx` (load / create / update).
4. UI in `EmployeeDetail.tsx` under Support Information: view chips + Admin inline edit.
5. Optional: CSV import in `scripts/import-employees.ts`.

### Schema
```sql
ALTER TABLE employees ADD COLUMN IF NOT EXISTS accommodations jsonb DEFAULT '[]'::jsonb;
```
Prefer `npm run db:push`; stop if data-loss warnings.

**Note:** If an earlier Cursor deploy already added this column, `db:push` should be a no-op. Do not drop the column.

### Out of scope
Admin CMS for field names (T3-B); folding into regulation strategies; notes feed.

### Acceptance tests
1. Admin adds “Magnifying glass”, “Adaptive grippers” → save → reload persists.
2. Empty state shows “None recorded”.
3. Regulation Strategies / Challenges unchanged.
4. Non-admins can view; only Admin edits (same as other support fields).

### Deploy
`npm run db:push` → publish/restart → smoke test as Admin.

### Report back
Migration result, screenshots or short notes, any leftover column from prior attempt.

---

## PACKET-003A — Form engine Phase 1 (core)

**Status:** ✅ Done (Joe, Aug 25) — design locked (`DESIGN_DECISIONS.md`)  
**Priority:** High — foundation for mid-year, certs, check-ins  
**Prerequisite:** PACKET-001 + 002 recommended first (not strictly required)  
**Blocked by Google Doc?** No

### Goal
Admin can create **form templates** with sections and questions. Phase 1 delivers schema, API, Admin builder UI (templates only — **no fill-for-employee from builder**, B22), question registry + response APIs for profile cards, and **8 working question types**. Advanced types register in schema but may render as “coming soon” until Phase 4.

### Reference implementation
Copy patterns from **Goal Templates** (`GoalTemplates.tsx`, `goal_templates`, `goal_template_steps`, routes in `server/routes.ts`).

### Schema (additive only — `shared/schema.ts` + `npm run db:push`)

```text
form_templates
  id, name, description
  form_type          -- enum: mid_year_review | mentor_certification | shift_lead_certification |
                     --       coach_checkin | roi_onboarding | custom
  status             -- active | inactive | archived
  version            -- integer, default 1
  settings_json      -- { allowed_fill_roles: string[], lock_on_submit: true }
  created_by, created_at, updated_at

form_sections
  id, template_id, title, sort_order, status

form_questions
  id, template_id, section_id (nullable)
  stable_key, prompt, help_text, question_type, config_json
  sort_order, status

form_response_sets
  id, template_id, template_version, employee_id
  cycle_label (nullable), status (draft | submitted)
  submitted_by, submitted_at, created_at, updated_at

form_answers
  id, response_set_id, question_id
  value_json, snapshot_json, answered_by, updated_at
```

**Indexes:** `employee_id`, `template_id`, `response_set_id`, unique on `(template_id, employee_id, cycle_label)` where cycle_label not null.

**Zod:** insert/select types for all tables (match existing Drizzle patterns).

### New permission features (same PR)

Add to `PERMISSION_FEATURES` + labels + seed defaults in `server/routes.ts`:

| Key | Label | Default Modify |
|-----|-------|----------------|
| `form_responses` | Form & Review Responses | Admin + Shift Lead: view; Guardian/Job Coach: view **off** |
| `external_user_invites` | External User Invites | Admin **on** only |

Use existing `role_permissions` / Permissions Manager — no UI redesign needed beyond new rows.

### API (`server/routes.ts` — all `authenticateToken`)

**Admin template CRUD**
- `GET/POST /api/form-templates`
- `GET/PUT/DELETE /api/form-templates/:id` (soft-delete → status archived)
- `POST /api/form-templates/:id/duplicate`
- Nested or separate endpoints for sections/questions reorder

**Response sets**
- `GET /api/scoopers/:scooperId/form-responses?template_id=&cycle_label=`
- `POST /api/form-response-sets` — create draft
- `PUT /api/form-response-sets/:id` — save answers (draft)
- `POST /api/form-response-sets/:id/submit` — lock; snapshot each answer
- ACL: `canAccessScooper` + `form_responses` permission + template `allowed_fill_roles`
- **View rule (locked):** Guardian/Job Coach denied unless `form_responses` View enabled for their role

**Server helpers (new file e.g. `server/scooperAccess.ts`)**
- `canAccessScooper(user, scooperId): Promise<boolean>`
- `canViewFormResponses(user, scooperId): Promise<boolean>`
- `canFillForm(user, template, scooperId): Promise<boolean>`

Start by centralizing logic already scattered in routes (coach_assignments, guardian_relationships, manager roles).

### Question types — Phase 1 MUST render

| type | Fill UI |
|------|---------|
| `free_text` | Single-line input |
| `long_text` | Textarea |
| `yes_no` | Yes / No toggle or buttons |
| `single_select` | Dropdown + chip style via `config_json.display.style` — dropdown mode uses **`AppSelect`** (B23), not `<select>` |
| `multi_select` | Checkbox list |
| `date` | `<input type="date">` |
| `date_time` | datetime-local or date + time pair |
| `section_header` | Read-only heading |
| `help_text` | Read-only paragraph |
| `scale` | 1–5 (or configurable min/max) rating control — **required for mid-year** |

**Register but stub OK in Phase 1:** `rich_text`, `number`, `email`, `phone`, `time`, `signature`, `file`, `repeatable_group`, `divider`

**Mid-year note:** Each rated question also needs an optional linked `long_text` notes field (see `MIDYEAR_REVIEW_QUESTIONS.md`).

`config_json` shape — see `FORM_ENGINE_SPEC.md` §2.3 (options, validation, display).

**Answer snapshot on submit** (`snapshot_json`):
```json
{ "prompt": "...", "question_type": "yes_no", "options": [...], "value": { "bool": true } }
```

### Admin UI

**UX parity (locked B21):** Must match **`GoalTemplates.tsx`** — see **PACKET-003A-UX** if the shipped 003A builder diverged.

- **Sidebar:** new item **“Forms & Reviews”** — Administrator only (same pattern as Goal Templates link in `Sidebar.tsx` + route in `App.tsx`)
- **List page:** same as Goal Templates — search, All/Active/Archived pills, white **table**, Create Template button
- **View page:** full-page read-only detail (back button, info cards, question list like Goal Steps)
- **Create/Edit:** **`Modal` `size="xl"`** — NOT a separate designer page
  - Fields: template name, description, **form_type** (with helper text), settings as needed
  - Questions: numbered bordered cards, Add Question / remove X (mirror Goal Steps)
  - Sections: optional headings inside the same list — no separate section manager UI
  - Reorder: up/down buttons fine — no drag palette
  - Deactivate question (status inactive) — do not hard-delete if answers exist
- **Table actions:** View (Eye) / Edit / Duplicate / Archive — same icons as Goal Templates
- **No fill from builder (B22):** Do not add scooper picker, “Open for employee,” or test fill entry on this screen — same as Goal Templates (no goal assignment from that page)

### Response fill UI (component + API only in 003A)

- Build `FormResponseFill.tsx` + question registry for **reuse on profile cards** (003B) and cert/check-in flows — not wired into the admin builder.
- APIs: create draft, save answers, submit — tested via profile cards in 003B (or API/integration tests in 003A).

### Files to touch (expected)

| Area | Files |
|------|--------|
| Schema | `shared/schema.ts` |
| API | `server/routes.ts`, new `server/scooperAccess.ts` |
| Admin UI | new `FormTemplates.tsx` or `FormsAndReviews.tsx`, `Sidebar.tsx`, `App.tsx` |
| Fill UI | `FormResponseFill.tsx` + registry — **profile/cert surfaces only**, not admin builder |
| State | extend `DataContext.tsx` or use fetch in components (match Goal Templates) |
| Permissions | `shared/schema.ts` PERMISSION_FEATURES, seed in `server/routes.ts`, `PermissionsManager.tsx` labels |

### Out of scope (003A)

- Mid-year profile card (003B) — first user-facing fill entry point
- Fill-for-employee from admin builder (B22)
- Cert migration / dual-read (003B)
- Conditionals (`show_when`) — Phase 3
- Coach check-in replacement — Phase 3
- Google Doc seed — PACKET-004
- Notes feed, invites UI — PACKET-005/006
- All advanced type renderers — Phase 4

### Acceptance tests

1. Admin creates template `Test Mid-Year` type `mid_year_review` with 2 sections, 5 questions mixing yes_no, free_text, single_select, date.
2. Admin duplicates template → new id, same questions.
3. Admin deactivates one question → hidden from new fill; old submitted sets still show snapshot.
4. Forms & Reviews has **no** scooper picker or “fill for employee” action (B22).
5. `npm run db:push` — additive only, no data-loss warnings ignored.

**Fill / submit / ACL** — acceptance in **PACKET-003B** (Reviews + Forms cards).

### Deploy

`npm run db:push` → publish → smoke test as Admin.

### Report back

- Migration output
- Screenshot or short Loom of Admin create template + view (no fill-from-builder UI)
- List of any stubbed types
- Permission seed confirmed in Permissions Manager

---

## PACKET-003A-UX — Form builder parity with Goal Templates

**Status:** ✅ Done (Joe, Aug 28)  
**Priority:** High (product consistency)  
**Prerequisite:** PACKET-003A ✅ done  
**Effort:** ~half day

### Goal

Refactor the Forms & Reviews **admin builder** so it matches the **Goal Templates** experience (`GoalTemplates.tsx`). Admins should not learn a second UI pattern. Introduce shared **`AppSelect`** for all dropdowns (B23) so menus look identical on every OS.

### Problem

If 003A shipped a separate designer page, drag-and-drop palette, card grid, wizard, or **native `<select>`** dropdowns, that is a **departure** from product standards and must be replaced.

### AppSelect component (B23 — do first in this packet)

Create `client/src/components/ui/AppSelect.tsx` (or refactor `SelectInput` in `FormInput.tsx` to use custom panel internally).

**API (suggested):**
```tsx
<AppSelect
  label="Form type"
  value={formType}
  onChange={setFormType}
  options={[{ value: 'custom', label: 'Custom form' }, ...]}
  helpText="Controls where this template appears on profiles."
/>
```

**Visual:** Trigger matches `INPUT_BASE_CLASSES`; chevron right; white `rounded-xl` option panel with hover/selected states — see `FORM_ENGINE_SPEC.md` §8.

**Replace in this packet:**
- Forms & Reviews builder: `form_type`, question type, any enum field
- `GoalTemplates.tsx`: duration unit dropdown (so Goal Templates and Forms match)
- Form fill `single_select` renderer if already built — use `AppSelect` for `display.style = dropdown`

**Do not use** native `<select>` in new or refactored code.

### Required UX (copy from `GoalTemplates.tsx`)

**1. List page (`FormsAndReviews.tsx` or `FormTemplates.tsx`)**
- `p-3 sm:p-6 max-w-6xl mx-auto` container
- Row: Search input (left icon) + **All / Active / Archived** filter pills + **Create Template** button (blue, Plus icon)
- White `rounded-xl` **table** (not card grid):
  - Columns: **Template** (name + description subtitle), **Type** (`form_type` label), **Questions** (count), **Status** (badge), **Actions**
  - Actions: **Eye** (view), **Edit**, **Copy** (duplicate), **Archive** — same icon buttons + hover colors as Goal Templates

**2. View mode (full page, not modal)**
- Back (X) + template name header
- Action bar: Edit, Duplicate, Archive (when active)
- White cards: **Form Information** (description, form type, status) + **Questions (N)** list in bordered rows (like Goal Steps)

**3. Create / Edit (Modal only)**
- Use shared `Modal` component with `size="xl"` and title “Create New Template” / “Edit Template”
- Top fields: name, description (textarea), **form_type** `AppSelect` + helper text
- **Questions** section header with **Add Question** link (blue, Plus) — mirror **Goal Steps** / **Add Step**
- Each question in a `border rounded-xl p-4` card:
  - Header: “Question N” + remove X (if more than one)
  - Fields: question type `AppSelect`, prompt (textarea), help text, required checkbox
  - Select types: inline options list (add/remove rows) — same density as step timer/required fields
- Optional **sections**: render as a simple heading row in the scrollable list (`max-h-96 overflow-y-auto`) — not a second panel
- Footer: Cancel + Create/Update Template (border-t, right-aligned)

**4. Behavior parity**
- Duplicate → opens modal with “(Copy)” name
- Archive → `confirm()` dialog, same copy tone as goals
- Default filter: **Active**
- Administrator-only access denied screen (match Goal Templates)

**5. Do NOT keep**
- Full-page `/edit` route for templates
- Left sidebar question palette or drag-and-drop canvas
- Multi-tab “Designer | Preview | Settings” chrome
- A visual style that doesn’t reuse Goal Templates Tailwind classes
- **Scooper picker / “Open for employee” / test fill** from the builder (B22) — remove if 003A added one

### Files

| Area | Action |
|------|--------|
| `client/src/components/FormTemplates.tsx` (or equivalent) | Refactor to mirror `GoalTemplates.tsx` structure |
| `client/src/components/ui/AppSelect.tsx` | **New** — shared custom dropdown (B23) |
| `client/src/components/GoalTemplates.tsx` | Replace duration native `<select>` with `AppSelect` |
| `client/src/components/ui/Modal.tsx` | Reuse — do not replace |
| `client/src/App.tsx` | Keep single list route; view mode is in-component state like goals |
| Optional later | Extract shared `TemplateTable` / `TemplateViewHeader` — **not required** for this packet |

### Out of scope

- Profile Reviews/Forms cards (003B)
- Fill UI changes (unless preview is already in view mode)
- New question types
- Drag reorder (up/down buttons OK)

### Acceptance tests

1. Side-by-side screenshot: Goal Templates list and Forms & Reviews list — same layout rhythm (search, pills, table, create button).
2. Create template in **modal** → add 3 questions → save → appears in table.
3. **View** (Eye) → full-page read-only → **Edit** opens same modal.
4. **Duplicate** → “(Copy)” in modal → saves as new row.
5. **Archive** → confirm → hidden from Active filter; visible under Archived.
6. No route exists that is a standalone full-page form designer.
7. No UI in Forms & Reviews to pick an employee and fill a form (B22).
8. All dropdowns use **`AppSelect`** — screenshot on Windows and Mac (or browser devtools) shows identical open menu styling, not OS-native select chrome (B23).

### Report back

- Before/after screenshots (list + modal + view)
- Confirm which 003A patterns were removed

---

## PACKET-003B — Mid-year profile card + cert migration + seed

**Status:** ✅ Done (Joe, Aug 28)  
**Priority:** High  
**Blocked by?** Mid-year question text — ✅ locked (`MIDYEAR_REVIEW_QUESTIONS.md`)

### Goal
1. Seed the **Mid-Year Review** template from locked questions.  
2. Add a **Reviews** card on Super Scooper profiles to draft/submit/view mid-year responses.  
3. Add a **Forms** card on Super Scooper profiles for `form_type = custom` templates (separate from Reviews).  
4. Migrate **promotion certification checklists** onto form templates (dual-read legacy JSON).

### A. Seed Mid-Year Review template

Create (or upsert) an **active** template:

| Field | Value |
|-------|--------|
| name | Mid-Year Review |
| form_type | `mid_year_review` |
| cycle for new responses | `2026-mid-year` (or current year mid-year) |
| settings | `allowed_fill_roles`: Administrator, Shift Lead; `lock_on_submit`: true |

**Questions** — exact copy from `MIDYEAR_REVIEW_QUESTIONS.md`:

| # | stable_key | type | Notes field |
|---|------------|------|-------------|
| 1 | `task_independence` | scale 1–5 | optional `task_independence_notes` long_text |
| 2 | `communication` | scale 1–5 | optional `communication_notes` long_text |
| 3 | `self_advocacy` | scale 1–5 | optional `self_advocacy_notes` long_text |
| 4 | `feedback_acceptance` | scale 1–5 | optional `feedback_acceptance_notes` long_text |
| 5 | `job_duty_consistency` | scale 1–5 | optional `job_duty_consistency_notes` long_text |
| 6 | `milestones_celebrated` | long_text | — |

Prefer a one-time seed script (`scripts/seed-midyear-review.ts` or Admin “Seed Mid-Year” once) so production gets the same wording.

**Do not** bulk-import PDF scores in this packet — Allison enters those after UI exists (PACKET-004 / manual).

### B. Reviews card on Super Scooper profile

**New component** (do **not** dump into `EmployeeDetail.tsx` monolith): e.g. `client/src/components/EmployeeReviewsCard.tsx`

Mount on Super Scooper profiles in `EmployeeDetail` (near goals / notes area).

**Behavior**
- List response sets for this scooper for `form_type = mid_year_review` (and later other review types).
- Actions: **Start** (creates draft for cycle), **Continue draft**, **View submitted**.
- Fill UI: reuse `FormResponseFill` / question registry from 003A; `single_select` dropdown mode uses **`AppSelect`** (B23).
- ACL: fill = Admin + Shift Lead (or template settings); view = `form_responses` permission (Guardian/Job Coach off by default).
- After submit: read-only except Admin edit (per DESIGN_DECISIONS B7).

**Empty state:** “No mid-year review yet” + Start button for allowed roles.

### C. Forms card on Super Scooper profile (custom forms)

**New component:** e.g. `client/src/components/EmployeeCustomFormsCard.tsx` — mount alongside Reviews card in `EmployeeDetail`.

**Behavior**
- List **active** templates where `form_type = custom`.
- For each template (or grouped list): show response sets for this scooper — **Start**, **Continue draft**, **View submitted**.
- Fill UI: reuse `FormResponseFill` / question registry from 003A; `single_select` dropdown mode uses **`AppSelect`** (B23).
- ACL: same as Reviews — fill per template `allowed_fill_roles`; view via `form_responses` permission.
- After submit: read-only except Admin edit (DESIGN_DECISIONS B7).

**Empty state:** “No custom forms yet” when no active custom templates exist; per-template empty state when template exists but scooper has no response.

**Admin builder polish:** under **form type** dropdown on template edit, show helper text: “Form type controls where this template appears — Reviews card for employee reviews, Forms card for custom forms, certification flow for certs.”

### D. Promotion certification migration (dual-read)

**Today:** Hardcoded `mentorChecklistItems` / `shiftManagerCategories` in `EmployeeDetail.tsx`; answers in `promotion_certifications.checklist_results` JSONB.

**Approach**
1. Seed two templates: `Mentor Certification` (`mentor_certification`), `Shift Lead Certification` (`shift_lead_certification`) from current hardcoded arrays (yes_no questions; Shift Lead uses **sections** matching categories).
2. Additive column: `promotion_certifications.response_set_id` (nullable FK → `form_response_sets`).
3. **New certs:** create form response set + checklist answers via form engine; store `response_set_id`; still write `checklist_results` for a short dual-write period **or** only response_set if review UI can read both.
4. **Old certs:** keep displaying `checklist_results` when `response_set_id` is null.
5. Cert create/review UI loads questions from template when available; fall back to hardcoded arrays only if template missing.

**Do not** rewrite historical `checklist_results` into form_answers in this packet.

### E. Out of scope

- Conditionals / coach check-in migration (003C)
- Bulk PDF answer import (004)
- Notes feed, invites (005/006)
- Removing hardcoded cert arrays entirely (only after dual-read proven in prod)
- Advanced question types beyond what 003A already renders

### Acceptance tests

1. Admin opens Forms & Reviews → sees seeded **Mid-Year Review** with 6 prompts matching `MIDYEAR_REVIEW_QUESTIONS.md`.
2. As Shift Lead: open Super Scooper → Reviews card → Start mid-year → rate 1–5 + notes → save draft → reload persists → submit → locked.
3. Admin creates a **Custom form** template → appears on Super Scooper **Forms** card (not Reviews) → Shift Lead can fill draft → submit → locked.
4. Guardian linked to that scooper: **cannot** see mid-year or custom form answers (default). Admin enables `form_responses` View for Guardian → can see.
5. Admin creates Mentor cert using template questions (not only hardcoded); old certs with only `checklist_results` still open and display answers.
6. Shift Lead cert categories appear as sections.
7. `npm run db:push` additive only (`response_set_id` nullable).

### Deploy

`npm run db:push` → run seed script → publish → smoke Admin + Shift Lead + Guardian.

### Report back

- Confirm seed script path / how to re-run safely  
- Screenshots: Reviews card draft + submitted; Forms card with custom template; cert create from template; old cert still readable

---

## PACKET-003B-FIX — Reviews / Forms repair (post-audit)

**Status:** Ready — do **before** PACKET-004 data entry or new features  
**Priority:** High  
**Prerequisite:** PACKET-003B + 003C ✅ on `main`  
**Effort:** ~half day  
**Source:** Cursor code review of `main` (Aug 29, 2026)

### Why

003B/003C shipped most of the form engine, but the profile still has **two review systems** and is **missing the custom Forms card** (B20). Fix these before Allison enters PDF data (004) or users create custom templates.

### A. One mid-year path only — remove legacy reviews from profile

**Problem:** `EmployeeDetail.tsx` mounts **both**:
- `EmployeeReviewsCard` (form engine — correct, locked mid-year questions)
- `EmployeeReviews` embedded as “Previous Reviews” (legacy `employee_reviews` table — **wrong questions**)

**Do:**
1. **Remove** `<EmployeeReviews employeeId={…} embedded />` from inside `EmployeeReviewsCard` (and remove unused import if nothing else uses it on profile).
2. **Do not** show legacy `EmployeeReviews` on Super Scooper profiles unless product explicitly wants a separate “archive” (default: **hide entirely**).
3. If any rows exist in `employee_reviews`: either leave table/API for admin export only, or one-time migrate text into form responses — **not required for this packet** unless Allison already entered data there (unlikely). Document choice in report-back.

**Keep:** `EmployeeReviewsCard` + `FormFiller` for `form_type = mid_year_review` only.

### B. Add **Forms** card for custom templates (B20)

**Problem:** Admin can create `form_type = custom` templates, but profiles have **no entry point** to start/fill them.

**Do:** New component `EmployeeCustomFormsCard.tsx` (mirror `EmployeeReviewsCard.tsx`):

- Mount on Super Scooper profiles in `EmployeeDetail` **below** Reviews card (separate section — not nested inside Reviews).
- List **active** templates where `form_type = custom`.
- Per template: list response sets for this scooper — **Start**, **Continue draft**, **View submitted**.
- Reuse `FormFiller` from `FormsAndReviews.tsx`.
- ACL: same as Reviews — `form_responses` permission + template `allowed_fill_roles`.
- Empty state: “No custom forms yet” when no active custom templates.

### C. Polish (same packet if quick)

| Item | Action |
|------|--------|
| **B23** | Replace native `<select>` in `GoalTemplates.tsx` (duration unit, timer type) with `AppSelect` |
| **B21 helper** | Under form type dropdown in builder modal, add: “Form type controls where this template appears — Reviews card for employee reviews, Forms card for custom forms, certification flow for certs.” |
| **Security** | Add `canAccessScooper` (or `canAccessSuperScooper`) to `GET /api/employees/:id/assessment-history`, `assessment-history-details`, and `GET /api/certifications/:employeeId` |

### Out of scope

- PACKET-004 PDF bulk import
- Removing hardcoded cert fallback arrays (only if templates always seeded in prod)
- Deprecating `employee_reviews` table/API entirely (optional follow-up)

### Acceptance tests

1. Super Scooper profile shows **one** Reviews area — mid-year via form engine only; **no** “Previous Reviews” legacy block.
2. Admin creates active **Custom form** template → appears on profile **Forms** card (not inside Reviews) → Shift Lead can Start → draft → submit.
3. Guardian (default): cannot see mid-year or custom form answers; Admin enables `form_responses` View → can see.
4. Goal Templates duration/timer use `AppSelect` (same open-menu styling as Forms builder).
5. Unassigned user cannot `GET` another employee’s assessment-history or certifications by ID (403).

### Report back

- Screenshot: profile with Reviews + **separate** Forms cards
- Confirm legacy `EmployeeReviews` removed from profile (and whether any `employee_reviews` rows existed)
- Note any assessment/cert ACL changes

---

## Later packets

| Packet | Topic | Blocked by | Next? |
|--------|--------|------------|-------|
| **PACKET-003B-FIX** | Reviews dedupe + Forms card + polish | 003B ✅ | ✅ Done Aug 29 |
| **PACKET-003C** | Conditionals + coach check-in migration | 003B ✅ | ✅ Done |
| PACKET-004 | Historical PDF mid-year answers (Allison) | 003B-FIX ✅ | **Product now** |
| PACKET-005 | Unified notes feed (T5) | 003C ✅ | ✅ On main |
| PACKET-006 | Invites + `external_user_invites` (T6) | 005 optional | Partial on main |
| **PACKET-003D** | Advanced types + ROI subset | 003B-FIX ✅ | **Replit next** |
| PACKET-007 | Profile field catalog (T3-B) | 003A ✅ | Partial on main — verify |

# Work packets — Cursor (Architect) → Replit (Implementer)

Paste one packet at a time into Replit. Do not implement from this repo’s Cursor Cloud agent unless product explicitly overrides the working model.

**Design locked:** `DESIGN_DECISIONS.md` · **Form spec:** `FORM_ENGINE_SPEC.md`

---

## Start here — recommended order

| Order | Packet | Effort | Why this order |
|-------|--------|--------|----------------|
| **1** | **PACKET-001** | ~1 hour | Quick win for Ali; confirms T1 before bigger work |
| **2** | **PACKET-002** | ~half day | Small schema + UI; independent of form engine |
| **3** | **PACKET-003A** | multi-day | Form engine foundation — do **not** skip 001/002 unless Ali/accommodations are explicitly deferred |
| 4 | PACKET-003B | multi-day | Certs + mid-year profile card (after 003A) |
| … | PACKET-004 | small | Seed mid-year questions — **needs Google Doc** |

**Do not start with 003A alone** unless T1/T2 are already done or explicitly postponed.

---

## PACKET-001 — T1: Manager Service Provider / Job Coach visibility

**Status:** Ready to issue after quick Replit confirm  
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

**Status:** Draft — issue after T1 ships or in parallel if Option B  
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

**Status:** Ready — design locked (`DESIGN_DECISIONS.md`)  
**Priority:** High — foundation for mid-year, certs, check-ins  
**Prerequisite:** PACKET-001 + 002 recommended first (not strictly required)  
**Blocked by Google Doc?** No

### Goal
Admin can create **form templates** with sections and questions; staff can save **draft** and **submit** answers for a scooper. Phase 1 delivers schema, API, Admin builder UI, and **8 working question types**. Advanced types register in schema but may render as “coming soon” until Phase 4.

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
| `single_select` | Dropdown + chip style via `config_json.display.style` |
| `multi_select` | Checkbox list |
| `date` | `<input type="date">` |
| `date_time` | datetime-local or date + time pair |
| `section_header` | Read-only heading |
| `help_text` | Read-only paragraph |

**Register but stub OK in Phase 1:** `rich_text`, `number`, `scale`, `email`, `phone`, `time`, `signature`, `file`, `repeatable_group`, `divider`

`config_json` shape — see `FORM_ENGINE_SPEC.md` §2.3 (options, validation, display).

**Answer snapshot on submit** (`snapshot_json`):
```json
{ "prompt": "...", "question_type": "yes_no", "options": [...], "value": { "bool": true } }
```

### Admin UI

- **Sidebar:** new item **“Forms & Reviews”** — Administrator only (same pattern as Goal Templates link in `Sidebar.tsx` + route in `App.tsx`)
- **List page:** templates filtered by status; search; Create / Duplicate / Archive
- **Edit page:** template name, form_type, sections, questions list
  - Add question → pick type → prompt, help, options (for selects), required flag
  - Reorder sections/questions (up/down buttons fine — no drag required v1)
  - Deactivate question (status inactive) — do not hard-delete if answers exist
- **Preview:** optional read-only preview of fill UI

### Fill UI (minimal v1)

No profile card required in 003A — can be a standalone test route or simple modal:
- Admin picks template + scooper → create draft → fill → save draft → submit
- **PACKET-003B** adds Reviews card on `EmployeeDetail.tsx`

### Files to touch (expected)

| Area | Files |
|------|--------|
| Schema | `shared/schema.ts` |
| API | `server/routes.ts`, new `server/scooperAccess.ts` |
| Admin UI | new `FormTemplates.tsx` or `FormsAndReviews.tsx`, `Sidebar.tsx`, `App.tsx` |
| Fill UI | new `FormResponseFill.tsx` + registry `formQuestionRegistry.tsx` |
| State | extend `DataContext.tsx` or use fetch in components (match Goal Templates) |
| Permissions | `shared/schema.ts` PERMISSION_FEATURES, seed in `server/routes.ts`, `PermissionsManager.tsx` labels |

### Out of scope (003A)

- Mid-year profile card (003B)
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
4. Admin fills for a scooper: save draft → reload → answers persist.
5. Submit → status submitted; non-Admin cannot edit (403 or read-only).
6. Shift Lead with `form_responses` view can read submitted answers; Guardian cannot (default).
7. Admin enables Guardian `form_responses` View in Permissions → Guardian can view (if linked scooper).
8. `npm run db:push` — additive only, no data-loss warnings ignored.

### Deploy

`npm run db:push` → publish → smoke test as Admin.

### Report back

- Migration output
- Screenshot or short Loom of Admin create + fill + submit
- List of any stubbed types
- Permission seed confirmed in Permissions Manager

---

## Later packets

| Packet | Topic | Blocked by |
|--------|--------|------------|
| PACKET-003B | Certs + mid-year profile card + seed scripts | PACKET-003A |
| PACKET-004 | Seed mid-year from Google Doc | F1 Google Doc + 003B |
| PACKET-003C | Conditionals + coach check-in migration | 003B |
| PACKET-005 | Unified notes feed | 003A ACL helpers |
| PACKET-006 | Invites + `external_user_invites` enforcement | 005 optional |
| PACKET-003D | Advanced types + ROI subset | 003C |
| PACKET-007 | Profile catalog (T3-B) | 003A |

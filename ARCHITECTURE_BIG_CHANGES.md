# UP Architecture — Bigger Changes (T3–T7)

**Role:** Cursor = Architect / Lead · Replit = Implementer  
**Status:** Design draft for review — **do not implement until design review locks §5 decisions**  
**Companion docs:** `PROJECT_PLAN.md`, `WORK_PACKETS.md`, **`FORM_ENGINE_SPEC.md`** (full question-type + migration spec)

**Target:** “Almost everything” — one form engine migrates mid-year, certs, coach check-ins, ROI (partial), and shared option lists; profile catalog (T3-B) in parallel.

---

## 1. The real problem

Today, three kinds of “content” are stuck in code:

| Kind | Examples | Pain |
|------|----------|------|
| **Structured questionnaires** | Mid-year review, mentor/shift-lead cert checklists, coach check-ins | Every wording change = developer release |
| **Profile field catalogs** | Interests, Challenges, Strategies, (future) Accommodations | New categories = schema/UI deploys |
| **Communication** | Guardian notes, coach notes, check-in free text, assessment notes | Fragmented; families/staff can’t see one timeline |

The business ask (“Admins create forms, questions, checklists; add/update/deactivate field names”) is really: **make content a product feature, not a deploy.**

T1/T2 are small UX/data adds. T3–T7 are the platform shift.

---

## 2. North-star architecture (three platforms, one UX story)

```text
┌─────────────────────────────────────────────────────────────┐
│  Admin Console                                              │
│  • Form Templates (T3-A)   • Profile Field Catalog (T3-B)   │
│  • (later) Check-in templates (T3-C)                        │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│  Response Engine          │   │  Employee Profile           │
│  • Mid-year (T4)          │   │  • Dynamic support fields   │
│  • Cert checklists (T7)   │   │  • Notes feed (T5)          │
│  • Future forms           │   │  • Limited-access users (T6)│
└───────────────────────────┘   └─────────────────────────────┘
```

**Design rule:** One form engine powers reviews + certs (and later check-ins). Do not build a one-off “Review section” that can’t host cert checklists.

**Design rule:** Notes and limited-access users share an access model (“who can see this scooper / who can write”). Design T5 and T6 together even if you ship T5 first.

---

## 3. Platform A — Form Template Engine (T3-A, T4, T7)

### 3.1 Why this is the spine

- Mid-year questions (T4) and promotion checklists (T7) are the same shape: ordered questions → answers per employee → history.
- Goal Templates already prove Admin-managed ordered content works in this codebase (`goal_templates` + `goal_template_steps` + clone-to-instance pattern).

### 3.2 Proposed data model

```text
form_templates
  id, name, description
  form_type          -- 'mid_year_review' | 'mentor_cert' | 'shift_lead_cert' | 'custom'
  status             -- 'active' | 'inactive' | 'archived'
  version            -- integer, bump when published questions change in a breaking way
  created_by, created_at, updated_at

form_sections        -- optional grouping (Shift Lead cert already has categories)
  id, template_id, title, sort_order, status

form_questions
  id, template_id, section_id (nullable)
  prompt, help_text
  question_type      -- see FORM_ENGINE_SPEC.md §2 (17 answer types + 3 layout types)
  config_json        -- display, options, validation, conditionals (not just options_json)
  is_required, sort_order
  status             -- 'active' | 'inactive'  (soft-deactivate; never hard-delete if answers exist)
  stable_key         -- optional slug for analytics across renames

form_response_sets   -- one submission / cycle per employee
  id, template_id, template_version
  employee_id        -- the Super Scooper being reviewed/certified
  cycle_label        -- e.g. '2026-mid-year' or null for certs
  status             -- 'draft' | 'submitted'
  submitted_by, submitted_at
  created_at, updated_at

form_answers
  id, response_set_id, question_id
  value_json         -- { "bool": true } | { "text": "..." } | { "number": 3 } | { "selected": [...] }
  answered_by, updated_at
```

### 3.3 Versioning & deactivate (critical)

| Event | Behavior |
|-------|----------|
| Admin edits question **wording** on active template | Allowed; existing answers keep `question_id`; display uses current prompt or snapshot (recommend: **snapshot prompt on answer** for legal/history clarity on certs) |
| Admin **deactivates** question | Hidden from new response sets; old sets still show with stored prompt |
| Admin needs incompatible redesign | Create new template version or new template; don’t mutate in place |

**Recommendation for v1:** Snapshot `{ question_id, prompt, question_type, value }` into `form_answers` (or a `answer_snapshot` jsonb). Slightly denormalized; safest for mid-year + certs.

### 3.4 Admin UI — **must match Goal Templates** (locked B21)

**Reference:** `GoalTemplates.tsx` — Forms & Reviews is a sibling screen, not a new product.

| Screen | Goal Templates | Forms & Reviews |
|--------|----------------|-----------------|
| List | Search + status pills + table + Create | Same layout |
| View | Full-page read-only + Edit/Duplicate/Archive | Same |
| Edit | `Modal` xl + inline step list | `Modal` xl + inline question list (sections = headings) |
| Actions | View / Edit / Duplicate / Archive icons | Same |

**Do not ship:** drag-and-drop palette, full-page builder route, card-grid list, multi-tab designer, **fill/open-for-employee from the builder** (B22), or **native `<select>`** dropdowns (B23).

- Nav: **Forms & Reviews** (Admin only) — parallel to Goal Templates in sidebar
- **No delete** if any `form_response_sets` exist (archive only)

Detail: `FORM_ENGINE_SPEC.md` §5.1, §8 (`AppSelect`)

### 3.5 Employee / staff UX

| Form type | Where it lives | Who fills |
|-----------|----------------|-----------|
| Mid-year review | **Reviews** card on Super Scooper profile | Admin, Shift Lead |
| Mentor / Shift Lead cert | Replace hardcoded checklist in existing cert flow | Same roles as today |
| Custom | **Forms** card on Super Scooper profile (separate from Reviews) | Admin, Shift Lead (configurable per template) |

### 3.6 Migration path for T7 (certs)

Current: questions hardcoded in `EmployeeDetail.tsx`; answers in `promotion_certifications.checklist_results` JSONB.

**Recommended approach:**
1. Seed `form_templates` from current mentor + shift-lead arrays (one-time script).
2. New certs write `form_response_sets` + link `promotion_certifications.response_set_id` (additive column).
3. Keep reading legacy `checklist_results` for old rows.
4. Remove hardcoded arrays only after dual-read works in production.

**Do not** rewrite historical JSON into new tables in v1 unless needed for reporting.

### 3.8 Question types & migration scope

**Full catalog:** `FORM_ENGINE_SPEC.md`

v1 aims to migrate nearly all structured content:

- **Phase 1–2:** Core types + mid-year + cert checklists  
- **Phase 3:** Coach check-ins (requires conditionals + chip display)  
- **Phase 4:** Signature, file, rich text, repeatable groups (ROI partial)  
- **Phase 5:** Profile field catalog + shared option lists  

Goal assessment outcomes stay in `step_progress` (not form engine).

---

## 4. Platform B — Profile Field Catalog (T3-B)

### 4.1 Problem

Support Information categories are UI + sometimes schema constants. Accommodations as a one-off column repeats forever.

### 4.2 Two levels (don’t overbuild v1)

| Level | What Admin controls | Engineering cost |
|-------|---------------------|------------------|
| **B1 — Labels only** | Rename “Regulation Strategies”, hide a category | Low — config table + UI map |
| **B2 — Dynamic fields** | Add “Accommodations”, “Sensory supports” without schema deploy | Higher — values in EAV or JSON map |

### 4.3 Recommended path

**Ship T2 (accommodations) as a normal JSONB list** via Replit packet (like Challenges) — fast product need.

**Design T3-B toward B2**, but **implement B2 after T3-A** unless Admins are blocked weekly on new field names.

Proposed B2 shape:

```text
profile_field_definitions
  id, key, label, description
  value_shape     -- 'string_list' | 'string' | 'bool'  (start with string_list only)
  sort_order, status, applies_to_roles  -- e.g. Super Scooper only

employees.profile_field_values  -- jsonb map { "accommodations": ["..."], "challenges": ["..."] }
  OR keep existing columns and migrate gradually
```

**v1 advice:** Don’t migrate Interests/Challenges/Strategies into EAV yet. New fields after accommodations go into `profile_field_values`; old columns stay until a later cleanup.

---

## 5. Platform C — Notes + Access (T5 + T6)

### 5.1 Unified notes (T5)

**Current stores:** `guardian_notes` (1:1 upsert), `coach_notes` (rich, many), check-in notes, assessment notes.

**Recommended target model:**

```text
profile_notes
  id, scooper_id
  author_id, author_role_snapshot
  body           -- start plain text or TipTap JSON; pick one for v1 (plain is simpler)
  source_type    -- 'manual' | 'migrated_guardian' | 'migrated_coach' | 'checkin' | 'assessment'
  source_id      -- nullable link to original row
  created_at, updated_at
  status         -- 'active' | 'deleted' (soft)
```

**Feed API:** `GET /api/scoopers/:id/notes-feed` sorted by `created_at desc`, ACL-checked.

**Write rules (product must lock):**
- Anyone with profile access can add `manual` notes? or only Guardian/Coach/Admin/Shift Lead?
- Authors edit/delete own; Admin can delete any.

**Migration:**
1. Ship feed as **union view** of existing tables (no data move) — faster, messier.
2. Or migrate guardian + coach notes into `profile_notes` and leave assessment/check-in as linked `source_type` entries.

**Recommendation:** Phase 1 = aggregator API over guardian + coach notes (and optional check-in free-text). Phase 2 = single table + deprecate upsert unique on guardian notes (timeline instead of one note).

### 5.2 Lightweight users (T6)

**Current pain:** Parents/coaches are full `employees` rows with roles; invite flows are Admin-heavy; “view-only + notes” isn’t a first-class mode.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **A. Keep roles; tighten permissions** | Least schema change; Permissions Manager exists | Still “employee” records; coach check-ins still attached to Job Coach role |
| **B. Access tier flag** `access_level: 'full' \| 'limited'` | Clear product language | Must thread through every UI |
| **C. New roles** e.g. `Family Viewer`, `Coach Viewer` | Explicit | Role explosion; permission matrix grows |

**Recommendation:** **Option A for v1** — use `role_permissions` properly (enforce `usePermissions` / `requirePermission` instead of hardcoded role arrays), add invite UX from Contacts / Job Coach section, and document “limited” as a **permission preset**:

- View: linked scooper profiles, notes feed, (optional) goals progress read-only  
- Modify: notes only  
- No: assessments, certs, employee management, goal assignment  

Job Coaches who still need check-ins/files keep current Job Coach presets; “notes-only coach” is a permission variant, not a new role — **if product wants that**.

**Invite UX target:**
1. On scooper Contacts: Grant Access (already exists for Parent) — extend clarity + status.
2. On Job Coach section: “Invite coach” creates/links account + assignment + invitation in one Admin (or Shift Lead) flow.
3. Setup page stays (`AccountSetup`); skip employee-management screens for limited users.

### 5.3 Shared ACL primitive (do this once)

Introduce a small server helper used by notes, profile, reviews:

```text
canAccessScooper(actor, scooperId) → boolean
canWriteNotes(actor, scooperId) → boolean
canFillReview(actor, scooperId) → boolean
```

Today access is scattered (coach_assignments, guardian_relationships, role ∈ manager list). Centralizing unlocks T5/T6/T4 without rewriting ACL three times.

---

## 6. What depends on what (build graph)

```text
                    ┌──────────────┐
                    │ Design review│
                    │ lock §8      │
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
        T1 / T2         T3-A engine      ACL helper
      (Replit small)    (big)            (small shared)
           │               │               │
           │         ┌─────┴─────┐         │
           │         ▼           ▼         ▼
           │        T4          T7       T5 notes
           │     mid-year      certs      feed
           │         │           │         │
           │         └─────┬─────┘         │
           │               ▼               ▼
           │            Admin happy     T6 invites
           │            (no more        (permission
           │             content deploys) presets)
           └───────────────────────────────┘
```

**Parallelism:** T1/T2 can proceed on Replit during design review.  
**Do not** start hardcoded T4.  
**T5 before T6** if you must sequence; design ACL first either way.  
**T3-B** after Admins feel T3-A value (unless field-name churn is the louder pain).

---

## 7. Complexity & risk (honest)

| Work | Invasiveness | Main risk |
|------|--------------|-----------|
| T3-A form engine | High — new tables, Admin UI, profile/cert integration | Over-building types; weak versioning → broken history |
| T4 mid-year | Medium once engine exists | Shipping without engine = throwaway |
| T7 cert migration | Medium — dual-read legacy JSON | Breaking old cert review UI |
| T5 notes | Medium — ACL + UX; migration optional | Double notes or lost guardian upsert expectations |
| T6 limited users | Medium-High — permission enforcement debt | Permissions exist but UI still hardcodes roles |
| T3-B dynamic fields | Medium-High | Premature EAV; prefer accommodations column first |
| ACL helper | Low-Medium | Hidden until you touch notes/reviews |

**Permissions debt:** `PermissionsManager` + `role_permissions` exist, but much of the UI still uses hardcoded role arrays. T6 success depends on **actually enforcing** permissions — budget that as part of T5/T6, not a side chore.

---

## 8. Decisions to lock in design review

Must answer before Replit gets a T3 packet:

1. **Sequence:** Option A (design → T3-A → T4/T7) vs B (T1/T2 now, T3 parallel)?
2. **T3-A question types for v1:** yes/no + free text enough, or need scale/select?
3. **Answer snapshot:** store prompt with answer? (recommend yes)
4. **Who fills mid-year:** Admin only vs Admin + Shift Lead?
5. **Who sees mid-year answers:** staff only vs coaches/families?
6. **Cert migration:** dual-read legacy JSON (recommend) vs big-bang rewrite?
7. **Notes v1:** aggregator over existing tables vs new `profile_notes` table?
8. **Guardian notes:** keep one-note upsert or move to timeline?
9. **Limited users:** permission presets on existing roles (recommend) vs new roles?
10. **T3-B in v1?** recommend **out** — accommodations as normal field via PACKET-002
11. **Google Doc** — five mid-year questions exact text

---

## 9. Suggested design-review agenda (60–90 min)

1. Confirm business goal (Admin owns content) — 5 min  
2. Walk Platform A model (whiteboard template → response) — 20 min  
3. Decide T4 + T7 as first two form types — 15 min  
4. Notes + access sketch (Platform C) — 15 min  
5. Explicitly defer T3-B / check-in templates — 5 min  
6. Lock sequence + owners + first Replit packet after T1/T2 — 10 min  

**Exit criteria:** Written answers to §8; Cursor publishes **PACKET-003 (T3-A tech spec)** for Replit.

---

## 10. What Cursor will produce next (when you say go)

After design review (or if you want a strawman now):

1. **PACKET-003** — T3-A schema + Admin UI + API acceptance tests (Replit-sized slices: schema → CRUD API → Admin UI → mid-year profile card).  
2. **PACKET-004** — Seed mid-year template from Google Doc + response entry UX.  
3. **PACKET-005** — Cert dual-read migration.  
4. Parallel: refine PACKET-001/002 for small wins.

Until then: **no big-change implementation** — only planning + small Replit packets for T1/T2 if product chooses Option B.

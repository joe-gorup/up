# Form Engine Spec — “Almost Everything” v1

**Status:** Architect target for design review → Replit implementation  
**Goal:** One Admin-configurable form platform that can migrate **nearly all** structured content in UP today, without developer releases for wording/options changes.

**Companion:** `ARCHITECTURE_BIG_CHANGES.md`, `PROJECT_PLAN.md`

---

## 1. Scope: what “almost everything” means

### In scope (migrate into form engine + Admin builder)

| Source today | Migrate to |
|--------------|------------|
| Mid-year review questions (T4) | `form_templates` |
| Mentor / Shift Lead cert checklists (T7) | `form_templates` |
| Coach check-in questionnaire (T3-C) | `form_templates` |
| ROI consent choice + structured fields (partial) | `form_templates` or linked onboarding template |
| Custom / future Admin forms | `form_templates` |

### In scope (Profile Field Catalog — T3-B, parallel track)

| Source today | Migrate to |
|--------------|------------|
| Interests, Challenges, Regulation Strategies, Accommodations | `profile_field_definitions` + values |
| Allergies, service providers (structured lists) | same catalog with `value_shape` variants |
| Contact relationship dropdown options | `option_lists` config (shared with forms) |

### In scope (Notes — T5, uses some types indirectly)

| Source today | Approach |
|--------------|----------|
| Guardian notes, coach notes, check-in free text | Unified `profile_notes` feed; coach notes keep `rich_text` body |
| Check-in structured answers | Stored via form engine when check-ins migrate |

### Out of scope (stay specialized modules)

| Source | Why |
|--------|-----|
| Goal assessment **outcomes** + mastery streak logic | Tied to `step_progress`, timers, mastery — not generic Q&A |
| Goal template **steps** | Already Admin-managed; different lifecycle (assigned goals) |
| Auth (login/password) | Security module |
| File storage ACL for coach files | Storage layer; form engine stores **reference** to uploaded file |

**Rule:** Goal assessment can **reuse** `single_select` rendering for outcomes in the UI, but answers stay in `step_progress` — do not force through `form_response_sets`.

---

## 2. Question type catalog (v1 — full list)

### 2.1 Answer types (store in `form_answers.value_json`)

| Type | Admin label | Value shape | Notes |
|------|-------------|-------------|-------|
| `free_text` | Short text | `{ "text": "..." }` | Single-line default |
| `long_text` | Long text | `{ "text": "..." }` | Textarea; multiline flag |
| `rich_text` | Rich text | `{ "html": "..." }` | TipTap JSON or HTML; coach notes pattern |
| `yes_no` | Yes / No | `{ "bool": true \| false \| null }` | Null = unanswered |
| `single_select` | Single choice | `{ "selected": "option_key" }` | Dropdown or chips (display config) |
| `multi_select` | Multiple choice | `{ "selected": ["key", ...] }` | Checkboxes or multi dropdown |
| `date` | Date | `{ "date": "YYYY-MM-DD" }` | ISO date |
| `date_time` | Date & time | `{ "datetime": "ISO-8601" }` | **New to app** |
| `time` | Time only | `{ "time": "HH:mm" }` | Optional; rare but cheap to add |
| `number` | Number | `{ "number": 123.45 }` | Scores, counts, durations (non-timer) |
| `scale` | Scale / rating | `{ "value": 4, "max": 5 }` | 1–5, 1–10, Likert; configurable min/max/labels |
| `email` | Email | `{ "text": "user@..." }` | Validated |
| `phone` | Phone | `{ "text": "+1..." }` | Validated; reuse `PhoneInput` |
| `signature` | Signature | `{ "signature": "data:image/png;base64,..." \| storage_path }` | ROI pattern; prefer object storage path in prod |
| `file` | File upload | `{ "file_id": "uuid", "file_name": "..." }` | Links to existing coach-files / object storage |
| `repeatable_group` | Repeatable group | `{ "rows": [ { "sub_answers": {...} }, ... ] }` | ROI service providers, multi-contact blocks |

### 2.2 Layout / non-answer types (no `form_answers` row — or answer optional)

| Type | Purpose |
|------|---------|
| `section_header` | Category title (Shift Lead cert sections, check-in “Question 3”) |
| `help_text` | Instructions, legal copy snippet, read-only |
| `divider` | Visual separator |

### 2.3 Display config (on `form_questions`, not separate types)

```json
{
  "display": {
    "style": "dropdown" | "chips" | "radio" | "checkbox_list",
    "columns": 1,
    "show_icons": true,
    "icon_map": { "good": "👍" }
  },
  "options": [
    { "key": "good", "label": "Good", "icon": "👍", "status": "active" }
  ],
  "validation": {
    "required": true,
    "min_length": 0,
    "max_length": 5000,
    "min": 0,
    "max": 100,
    "allowed_file_types": ["application/pdf"],
    "max_file_size_mb": 10
  },
  "placeholder": "...",
  "default_value": null
}
```

---

## 3. Form engine features (required for migration)

These are **not** question types — they must ship with v1 or coach check-ins / certs won’t migrate.

| Feature | Used by |
|---------|---------|
| **Sections** | Shift Lead certs, long reviews |
| **Sort order / drag reorder** | All templates |
| **Soft deactivate** question/section/option | All; legal/history safety |
| **Template versioning** | Mid-year cycles, cert updates |
| **Answer snapshot** on save | `{ prompt, question_type, options, value }` per answer |
| **Conditional visibility** | Coach check-ins (“if yes, show follow-up”) |
| **Conditional required** | Safety details when safety = yes |
| **Option-level deactivate** | Hide old dropdown choice without breaking history |
| **Cycle label** on response set | `2026-mid-year`, `2026-annual` |
| **Draft vs submitted** | Staff save progress, lock after submit (configurable) |
| **Duplicate template** | Admin clones last year’s mid-year |
| **Stable keys** on questions | Analytics across renames (`big_win`, `safety_concern`) |

### Conditional logic model (v1)

Store on `form_questions`:

```json
{
  "show_when": {
    "question_stable_key": "big_win",
    "operator": "equals",
    "value": true
  }
}
```

Operators v1: `equals`, `not_equals`, `in`, `not_in`, `is_empty`, `is_not_empty`.

---

## 4. Shared config: option lists

Contact relationship types and other reused dropdowns should not be hardcoded.

```text
option_lists
  id, key, label, status

option_list_items
  id, list_id, key, label, sort_order, status
```

Forms and profile fields reference `option_list_id` instead of embedding options twice.

**Migrates:** contact relationship dropdown, cert-specific enums if desired.

---

## 5. Data model (updated)

```text
form_templates
  id, name, description, form_type, status, version
  settings_json   -- submit_lock, allow_draft, who_can_fill roles
  created_by, created_at, updated_at

form_sections
  id, template_id, title, sort_order, status

form_questions
  id, template_id, section_id, stable_key
  prompt, help_text, question_type
  config_json     -- display, options, validation, conditionals
  sort_order, status

form_response_sets
  id, template_id, template_version, employee_id
  subject_employee_id   -- scooper being reviewed (same as employee_id for mid-year)
  cycle_label, status, submitted_by, submitted_at

form_answers
  id, response_set_id, question_id
  value_json, snapshot_json, answered_by, updated_at

option_lists / option_list_items   -- shared dropdowns

profile_field_definitions          -- T3-B
  id, key, label, value_shape, option_list_id?, sort_order, status

employees.profile_field_values     -- jsonb map (gradual migration from columns)
```

### `form_type` enum (v1)

```text
mid_year_review
annual_review
mentor_certification
shift_lead_certification
coach_checkin
roi_onboarding
employee_intake
custom
```

Each type can define **default nav placement** and **who can fill** in template settings.

---

## 6. Migration matrix

| Legacy location | Types needed | Engine features | Phase |
|-----------------|--------------|-----------------|-------|
| `EmployeeDetail` mentor checklist | `yes_no`, `section_header` | snapshot, deactivate | **Phase 2** |
| `EmployeeDetail` shift lead checklist | `yes_no`, `section_header` | sections | **Phase 2** |
| `CoachCheckin.tsx` | `single_select`, `yes_no`, `long_text`, `section_header` | conditionals, chips display | **Phase 3** |
| Mid-year Google Doc | all core answer types | cycle_label, draft/submit | **Phase 2** |
| `OnboardingVerify` ROI | `single_select`, `signature`, `date`, `free_text`, `repeatable_group`, `phone` | onboarding flow wrapper | **Phase 4** |
| Guardian note modal | `long_text` (via notes feed, not form) | — | **T5** |
| Coach notes | `rich_text` + title field | notes module | **T5** |
| Interests/Challenges/etc. | `repeatable_group` of `free_text` OR string_list | profile catalog | **T3-B** |
| Contact relationships | `option_lists` | — | **T3-B** |
| Goal assessment outcomes | **Do not migrate** | — | N/A |

---

## 7. Implementation phases (Replit — sliced)

Aiming for “almost everything” does **not** mean one big bang. Ship in layers:

### Phase 1 — Engine core (Replit PACKET-003A)
- Schema: templates, sections, questions, response_sets, answers
- Admin CRUD for templates + questions (all **answer types** registered; renderers can stub advanced types)
- API: list/fill/submit response set
- Answer snapshot on submit
- Types fully working: `free_text`, `long_text`, `yes_no`, `single_select`, `multi_select`, `date`, `date_time`, `section_header`, `help_text`

### Phase 2 — First migrations (PACKET-003B)
- Mid-year profile card (T4)
- Cert checklists (T7) with dual-read legacy JSON
- Seed scripts from hardcoded arrays

### Phase 3 — Conditionals + coach check-in (PACKET-003C)
- Conditional show/required
- Chip display style
- Migrate `CoachCheckin` to load template by `form_type = coach_checkin`
- Deprecate hardcoded `SETTING_OPTIONS`, etc.

### Phase 4 — Rich + compliance types (PACKET-003D)
- `rich_text`, `file`, `signature`, `repeatable_group`, `email`, `phone`, `number`, `scale`, `time`
- ROI onboarding template (or subset)
- Wire file/signature to existing storage patterns

### Phase 5 — Profile catalog + option lists (T3-B, PACKET-004)
- `profile_field_definitions`, `profile_field_values`
- `option_lists` for contacts
- Gradual migration off hardcoded Support Information labels

### Phase 6 — Notes feed (T5) + invites (T6)
- Unified feed; link check-in/form submissions as feed entries where useful

---

## 8. Renderer registry (frontend pattern)

One React registry maps `question_type` → component:

```text
FreeTextInput, LongTextInput, RichTextEditor, YesNoToggle,
SingleSelectDropdown, SingleSelectChips, MultiSelect,
DatePicker, DateTimePicker, TimePicker, NumberInput,
ScaleInput, EmailInput, PhoneInput, SignaturePad,
FileUploadField, RepeatableGroup, SectionHeader, HelpText
```

Admin builder previews each type. Profile/fill UI uses same registry.

**Domain exception:** `GoalOutcomeButtons` stays in `EmployeeProgress` — not in registry.

---

## 9. Permissions (form engine)

| Action | Default role |
|--------|----------------|
| Manage templates | Administrator |
| Fill mid-year / custom forms | Administrator, Shift Lead (configurable per template) |
| Fill cert checklist | Administrator (same as today) |
| Fill coach checkin | Job Coach, Administrator |
| View submitted answers | Same as profile view ACL |
| View draft answers | Author + Admin |

Enforce via centralized `canAccessScooper` + template `settings_json.allowed_fill_roles`.

---

## 10. What we are explicitly NOT building in v1

- Visual form builder drag-from-palette (list + reorder is enough; match Goal Templates UX)
- Cross-form analytics dashboard
- Public/anonymous forms
- PDF export of responses
- Real-time collaborative editing of drafts
- Full ROI legal document CMS (link or embed existing doc; capture consent via form types)

---

## 11. Design review — lock these before Phase 1

1. Confirm **full type list** in §2.1 (any removals?)
2. **Submitted answers editable?** (recommend: Admin only after submit)
3. **Signature storage:** base64 in DB vs object storage path (recommend path)
4. **Rich text format:** TipTap JSON vs HTML (recommend TipTap JSON to match coach notes)
5. **Check-in migration:** replace hardcoded form entirely in Phase 3 vs run parallel
6. **ROI in form engine** vs separate onboarding module with shared types
7. **Profile catalog timing:** Phase 5 ok, or pull earlier?

---

## 12. Success criteria (“almost everything”)

Admins can, without a developer:

- [ ] Change mid-year and cert question wording and options  
- [ ] Add/deactivate questions and sections  
- [ ] Reconfigure coach check-in questions and conditional follow-ups  
- [ ] Add/rename/deactivate profile support field labels (Phase 5)  
- [ ] Reconfigure contact relationship dropdown options  
- [ ] Clone a template for a new review cycle  

Developers are only needed for **new platform capabilities**, not content edits.

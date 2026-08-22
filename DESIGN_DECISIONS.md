# UP Design Decisions — Locked Record

**Date:** August 22, 2026  
**Status:** Draft for team confirm — override any `[CONFIRM]` item  
**Approach:** **Build in place** (single repo, additive schema, phased migration)  
**Specs:** `FORM_ENGINE_SPEC.md`, `ARCHITECTURE_BIG_CHANGES.md`, `PROJECT_PLAN.md`

---

## A. Platform & sequence

| # | Decision | Locked answer | Notes |
|---|----------|---------------|-------|
| A1 | Build strategy | **In place** — extend existing UP app | Not a new project/repo |
| A2 | Delivery sequence | **Option A** | Design lock → T1/T2 (Replit) → Form engine Phases 1–2 → T4/T7 → Phase 3 check-ins → T5/T6 → T3-B Phase 5 |
| A3 | Hardcode mid-year temporarily? | **No** | Mid-year is first consumer of form engine (T4 after Phase 2) |
| A4 | T3 first priority | **Form engine + mid-year** | Certs migrate immediately after (T7); profile field names later (T3-B) |
| A5 | “Almost everything” type catalog | **Yes — full list in `FORM_ENGINE_SPEC.md` §2** | Phased renderers; all types registered up front |

---

## B. Form engine (T3)

| # | Decision | Locked answer | Notes |
|---|----------|---------------|-------|
| B1 | Data model | **Templates → sections → questions → response_sets → answers** | As `FORM_ENGINE_SPEC.md` §5 |
| B2 | Versioning | **Integer `version` on template; bump on breaking publish** | New response sets pin `template_version` |
| B3 | Deactivate vs delete | **Soft-deactivate only** when answers exist | Questions, sections, options: `active \| inactive` |
| B4 | Answer snapshot | **Yes** — store `{ prompt, question_type, options, value }` on save | Required for certs + mid-year history |
| B5 | Response cycle | **One response set per scooper per `cycle_label`** | e.g. `2026-mid-year`; certs may omit cycle |
| B6 | Draft vs submit | **Both** — draft while filling; submit locks (see B7) | Match assessment draft pattern |
| B7 | Edit after submit | **Administrator only** | Shift Lead can fill; Admin can unlock/edit submitted |
| B8 | Admin UI location | **New sidebar nav: “Forms & Reviews”** | Mirror Goal Templates UX (list, edit, reorder, duplicate) |
| B9 | Who manages templates | **Administrator only** | |
| B10 | Cert migration | **Dual-read** — legacy `checklist_results` JSON stays; new certs use `response_set_id` | No big-bang rewrite |
| B11 | Check-in migration (Phase 3) | **Replace hardcoded `CoachCheckin` questions** with template `form_type = coach_checkin` | One-time seed from current options |
| B12 | ROI onboarding | **Separate onboarding flow** using shared form types/renderer | Legal doc stays embed/link; not full CMS in v1 |
| B13 | Signature storage | **Object storage path** (not base64 in DB) | Same pattern as coach files / profile photos |
| B14 | Rich text format | **TipTap JSON** | Matches existing coach notes |
| B15 | Shared dropdowns | **`option_lists` table** | Contact relationships + reusable enums |
| B16 | Goal assessment outcomes | **Stay in `step_progress`** — NOT form engine | Domain-specific mastery logic |

### Who fills / views forms

| Form type | Fill | View answers |
|-----------|------|--------------|
| Mid-year review | **Administrator, Shift Lead** | **Staff by default;** Guardian/Job Coach via Permissions (see B17) |
| Mentor / Shift Lead cert | **Administrator** (same as today) | Staff with profile access |
| Coach check-in | **Job Coach, Administrator** | Staff + assigned coach |
| ROI onboarding | **Guardian / Super Scooper** (self) | Admin |

| # | Decision | Locked answer |
|---|----------|---------------|
| B17 | Mid-year visible to Guardians / Job Coaches? | **No by default** — ✅ **Locked (Joe, Aug 22):** Guardians and Job Coaches do **not** see mid-year answers unless Admin grants it in **Permission Settings** |
| B18 | Per-template fill roles configurable? | **Yes** — `settings_json.allowed_fill_roles` |
| B19 | Permission feature for form/review answers | **Add `form_responses`** to `PERMISSION_FEATURES` — View (and optionally Modify for fill). Default: staff roles View **on**; Guardian + Job Coach View **off**. Admin toggles per role in Permissions Manager |

---

## C. Profile catalog (T3-B)

| # | Decision | Locked answer | Notes |
|---|----------|---------------|-------|
| C1 | In initial v1? | **No — Phase 5** | After form engine proves value |
| C2 | Accommodations until then | **Normal JSONB field** (PACKET-002) | Same as Challenges; migrate to catalog later |
| C3 | Dynamic fields shape | **`profile_field_definitions` + `profile_field_values` JSONB** | Gradual migration off existing columns |
| C4 | Contact relationship options | **Migrate to `option_lists` in Phase 5** | Until then hardcoded is ok |

---

## D. Notes & access (T5, T6)

| # | Decision | Locked answer | Notes |
|---|----------|---------------|-------|
| D1 | Notes feed v1 approach | **Phase 1: aggregator API** over guardian + coach notes; **Phase 2: `profile_notes` table** | Avoid double UI during transition |
| D2 | Include in feed | **Free-form notes first**; check-in summaries as linked cards (not full Q&A inline); assessment notes **out of feed v1** | Keeps feed readable |
| D3 | Guardian notes model | **Timeline** — multiple entries per guardian (drop 1:1 upsert) | Required for real “feed” |
| D4 | Who can write notes | **Guardian, Job Coach, Shift Lead, Administrator** | Super Scooper: **no** v1 |
| D5 | Who can view notes | Same as **profile view ACL** for that scooper | |
| D6 | Note body format | **Plain text v1** for unified feed; coach rich notes linked or migrated in Phase 2 | |
| D7 | Edit/delete notes | **Author edits own; Admin deletes any** | |
| D8 | Limited-access model | **Permission presets on existing roles** — no new roles | Guardian = view + notes; Job Coach = full coach preset |
| D9 | Job Coach capabilities | **Keep check-ins + files + notes** for standard Job Coach | Optional future “notes-only coach” = permission preset |
| D10 | Guardian capabilities | **View linked scooper profile (read-only) + notes** | No assessments, no cert data, no goal documentation |
| D11 | Who can invite parents/coaches | **Administrator only v1** | Shift Lead invite: **Phase 2 of T6** `[CONFIRM]` |
| D12 | Invite UX | **From scooper profile** — Contacts (Guardian), Job Coach section (coach) | One flow: link + assignment + invitation |
| D13 | ACL implementation | **Central server helpers** `canAccessScooper`, `canWriteNotes`, `canFillReview` | Enforce + replace hardcoded role arrays over time |

---

## E. Small wins (T1, T2)

| # | Decision | Locked answer | Notes |
|---|----------|---------------|-------|
| E1 | T1 fix | **Expand View Details for Shift Lead + Assistant Manager** | Pending Ali Replit confirm |
| E2 | T2 accommodations | **Dedicated field** (not regulation strategies) | Replit PACKET-002 |
| E3 | T1/T2 owner | **Replit implements** | Cursor specs only |

---

## F. Still needs product input

| # | Item | Owner | Status |
|---|------|-------|--------|
| F1 | **Google Doc — five mid-year questions** (exact text) | Allison / Sarah | ⏳ **Waiting on product** — blocks PACKET-004 / T4 seed only |
| F2 | Mid-year staff-only visibility (B17) | Joe | ✅ **Locked** — no by default; configurable via `form_responses` permission |
| F3 | Shift Lead can invite parents/coaches (D11) | Allison / Joe | `[CONFIRM]` recommended Admin-only v1 |
| F4 | Ali Replit check — T1 root cause (A vs B) | Joe / Ali | ⏳ Replit PACKET-001 confirm |
| F5 | Super Scoopers ever write notes? | Product | Locked **no** for v1 — override if needed |

---

## G. Explicitly out of scope (v1)

- New app / separate forms product
- Goal assessment outcome migration to form engine
- PDF export of reviews
- Public/anonymous forms
- Full ROI legal document CMS
- Real-time collaborative draft editing
- Cross-form analytics dashboard
- Visual drag-from-palette form builder

---

## H. Replit implementation order (post-lock)

```text
1. PACKET-001  T1 manager visibility
2. PACKET-002  T2 accommodations
3. PACKET-003A Form engine Phase 1 (schema, Admin CRUD, core types)
4. PACKET-003B Phase 2 — mid-year card + cert migration + seed scripts
5. PACKET-004  T4 seed mid-year template (needs F1 Google Doc)
6. PACKET-003C Phase 3 — conditionals + coach check-in migration
7. PACKET-005  T5 notes aggregator + timeline guardian notes
8. PACKET-006  T6 invites + permission enforcement
9. PACKET-003D Phase 4 — signature, file, rich text, ROI subset
10. PACKET-007 Phase 5 — profile catalog + option_lists
```

---

## J. Blockers & parallel work

### Blocked on Google Doc (F1)
- **PACKET-004** — seed mid-year template with exact question text  
- **T4** — entering collected meeting data into the five questions  

Everything else proceeds. When the doc arrives, paste questions into F1 and run seed — no form-engine rework needed.

### Can start now (Replit)
| Packet | Work | Needs Google Doc? |
|--------|------|-------------------|
| PACKET-001 | T1 manager visibility | No |
| PACKET-002 | T2 accommodations | No |
| PACKET-003A | Form engine Phase 1 (schema, Admin CRUD, core types) | No |
| PACKET-003B | Cert migration + empty mid-year template shell | No — placeholder questions ok until F1 |
| PACKET-003C+ | Check-ins, notes, invites | No |

**Tip:** Admin can create/rename mid-year questions in the builder once 003B ships; the Google Doc is only needed to seed the *correct* initial wording in one shot.

---

| Role | Name | Date | OK / changes |
|------|------|------|--------------|
| Product | | | |
| Admin user | | | |
| Dev (Replit) | Joe | | |
| Architect | Cursor | 2026-08-22 | Draft locked pending F1–F4 |

**To finalize:** Confirm `[CONFIRM]` rows, provide F1 (Google Doc), complete F4 (Ali/T1).

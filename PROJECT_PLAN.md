# Unique Pathway (UP) — Feature Project Plan

**Last updated:** August 20, 2026  
**Source:** Family/mid-year review feedback + Admin configuration goals  
**Status:** Planning — design review recommended before major new development

---

## 1. Business goals

1. **Reduce developer dependency** — Admins (not engineers) create, update, and deactivate forms, questions, checklists, and field labels when content changes.
2. **Improve family & coach experience** — Lighter access for parents/job coaches; shared communication via notes.
3. **Support mid-year review workflow** — Capture structured review questions per Super Scooper without code releases.
4. **Make profile support info clearer** — Accommodations, service providers, coaches visible and editable by the right roles.

---

## 2. Topic inventory (all workstreams)

| ID | Topic | Status | Type | Notes |
|----|--------|--------|------|-------|
| **T1** | Manager (Ali) missing Service Provider / Job Coach sections | Investigate on Replit | Bug / UX | Likely collapsed “View Details” default for non-Admins |
| **T2** | Accommodations on profile | **In PR** ([#4](https://github.com/joe-gorup/up/pull/4)) | Feature | Dedicated field (separate from regulation strategies) |
| **T3** | Admin-controllable configuration (forms, checklists, field names) | Planned — **design first** | Platform | Strategic theme; see §3 |
| **T4** | Mid-year review questions (5 questions from Google Doc) | Blocked on doc + design | Feature | Should be first use of Admin form builder (T3) |
| **T5** | Unified notes feed (name, date, all authorized users) | Planned | Feature | Replace siloed guardian/coach note UIs |
| **T6** | Lightweight parent / job coach users (view + notes) | Planned | Feature | Streamlined invite; not full employee profile |
| **T7** | Promotion certification checklists Admin-editable | Planned (via T3) | Migration | Currently hardcoded in `EmployeeDetail.tsx` |

### Original email mapped to topics

| Email ask | Topic ID |
|-----------|----------|
| Better way to add parents and job coaches as users (view-only + notes) | T6 |
| Combine all notes into one feed with name/date; all with access can leave notes | T5 |
| Admin access to edit review section content — stop frequent developer updates | T3 + T4 |
| Accommodations somewhere? Or just with regulation strategies? | T2 (decided: separate field) |
| Ali as manager does not have service provider or job coach sections | T1 |
| Build five mid-year review questions into Review section | T4 |

### Clarifying follow-up (Admin control)

> Goal: reduce developer work; shift updates to Admin — e.g. creating forms with questions and checklists; adding, updating, or deactivating field names.

This expands “edit review content” into a **broader Admin configuration platform (T3)**, not a one-off hardcoded Review section.

---

## 3. Admin configuration platform (T3) — design target

### Intent

Admins manage content that today requires a developer release:

- Forms with questions and checklists  
- Add / update / **deactivate** field names and questions  
- Mid-year reviews, promotion certs, and (later) other questionnaires  

### What is already Admin-controlled today

| Area | How |
|------|-----|
| Goal templates & steps | Goal Templates UI + DB |
| Role permissions | Permissions Manager |
| Employee profile *values* | Inline edit on profiles |

### What still requires a developer today

| Area | Location |
|------|----------|
| Mentor / Shift Lead promotion checklist questions | Hardcoded arrays in `EmployeeDetail.tsx` |
| Mid-year review questions | Do not exist yet |
| Support Information category names | Hardcoded UI (Interests, Challenges, Strategies, Accommodations) |
| Coach check-in question structure | Hardcoded in `CoachCheckin.tsx` |
| Contact relationship dropdown options | Hardcoded in contacts UI |

### Proposed model (for design review)

```text
Form Template          e.g. "Mid-Year Review 2026", "Mentor Certification"
  └── Section          optional grouping
        └── Question   text, yes/no, free text, scale, multi-select
              └── status: active | inactive (never hard-delete if answers exist)

Employee Response Set  answers tied to template + version for history safety
```

**Closest existing pattern to reuse:** Goal Templates (`GoalTemplates.tsx` + `goal_templates` / `goal_template_steps`).

### Phased delivery of T3

| Phase | Scope | Outcome |
|-------|--------|---------|
| **T3-A** | Form / checklist builder + response storage | Admins own mid-year + cert questions |
| **T3-B** | Configurable profile field labels/categories | Admins add/rename/deactivate Support Info fields |
| **T3-C** | Extend builder to coach check-ins / other forms | One system for most questionnaires |

T4 (mid-year questions) and T7 (cert checklists) should be **consumers of T3-A**, not separate hardcoded features.

---

## 4. Open decisions (block design / build)

### Must answer before T3 / T4 build

1. **Google Doc** — share link or paste the five mid-year review questions.  
2. **T3 priority #1** — mid-year forms, promotion checklists, or profile field names first?  
3. **Question types at launch** — yes/no, free text, scale, multi-select, or mix?  
4. **Deactivate vs delete** — recommend soft-deactivate only when historical answers exist.  
5. **Who submits answers** — Admin only, or Shift Leads too?  
6. **Who can view review answers** — staff only, or also Guardians / Job Coaches?

### Must answer before T5 / T6 build

7. Notes feed: include coach check-ins + assessment notes, or only free-form notes?  
8. Guardian notes: stay one-per-guardian upsert, or become a timeline?  
9. Who can write notes — Guardians, Job Coaches, Shift Leads, Admins, Super Scoopers?  
10. Parent/coach access: view + notes only, or do coaches still need check-ins and files?  
11. Who can invite parents/coaches — Admin only, or Shift Leads too?

### Must confirm for T1

12. On Replit as Ali: does **View Details** reveal Service Provider / Job Coach, or are they missing entirely?

---

## 5. Sequencing options

### Option A — Design first, then build (recommended)

```text
Design review (T3 architecture + T4/T5/T6 touchpoints)
    → T1 quick fix (if confirmed)
    → Merge T2 (accommodations) if not already
    → T3-A form builder
    → T4 mid-year reviews (first template)
    → T7 migrate promotion checklists onto builder
    → T5 unified notes
    → T6 lightweight invites
    → T3-B configurable profile fields (optional follow-on)
```

**Why:** T3 shapes T4 and T7. Building mid-year as hardcoded now creates throwaway work. Notes (T5) and invites (T6) benefit from knowing who can access profiles and write notes.

### Option B — Ship quick wins, design in parallel

```text
T1 fix + merge T2
    → Design review for T3 (parallel)
    → T5 notes (independent-ish)
    → T3-A + T4
    → T6 invites
    → T7 cert migration
```

**Why:** Unblocks Ali and accommodations faster; accepts some rework risk if notes model must align with future limited-access users.

### Option C — Hardcode mid-year now, CMS later

```text
T1 → T2 → Hardcoded T4 → T5 → T6 → T3 later (migrate T4 + T7)
```

**Why:** Fastest path to data entry for this review cycle. **Cost:** second build to migrate into Admin config; conflicts with “stop frequent developer updates.”

**Recommendation:** Prefer **Option A** (or B if Ali/accommodations must ship immediately). Avoid Option C unless the mid-year data entry deadline is imminent and the Google Doc is ready.

---

## 6. Design review checklist (before major T3+ development)

Hold a short design / architecture review covering:

| # | Topic | Decision needed |
|---|--------|-----------------|
| 1 | Form template data model | Tables, versioning, soft-deactivate |
| 2 | Response model | Per employee, per cycle (mid-year / annual)? Editable after submit? |
| 3 | Admin UI location | New “Forms / Reviews” nav vs under Settings |
| 4 | Permissions | Who manages templates vs who fills responses |
| 5 | Migration of cert checklists | Big-bang vs gradual; preserve past `checklist_results` |
| 6 | Notes model | New unified table vs aggregator API over existing stores |
| 7 | Limited-access users | New role vs permission flags on Guardian / Job Coach |
| 8 | Profile field config (T3-B) | In or out of v1 scope |
| 9 | Sequence lock | Confirm Option A, B, or C |

**Suggested attendees:** Product owner (Allison/Sarah/Eileen), Joe (dev), Admin power user who will maintain forms.

**Outcomes of review:**

- Locked sequence  
- T3 v1 scope boundary (what is *not* in v1)  
- Answered open questions §4  
- Seed content: mid-year questions from Google Doc  

---

## 7. Current codebase anchors (for implementers)

| Topic | Key files |
|-------|-----------|
| Profile / support / certs | `client/src/components/EmployeeDetail.tsx` |
| Schema | `shared/schema.ts` |
| API | `server/routes.ts` |
| Goal template pattern (CMS analog) | `client/src/components/GoalTemplates.tsx` |
| Permissions | `client/src/components/PermissionsManager.tsx` |
| Guardian notes | `guardian_notes` + `MyLovedOnes.tsx` |
| Coach notes / check-ins | `coach_notes`, `coach_checkins`, `CoachCheckin.tsx` |
| Parent grant access | Contacts → Grant Access in `EmployeeDetail.tsx` |
| Guidelines | `DEVELOPMENT_GUIDELINES.md` (additive schema only) |

---

## 8. Definition of done (per topic)

| ID | Done when |
|----|-----------|
| T1 | Shift Lead sees Service Provider + Job Coach without confusion; verified as Ali on Replit |
| T2 | Admins can add/edit accommodations on profile; migrated in production |
| T3-A | Admin can create/edit/deactivate form questions; no code change for new questions |
| T4 | Five mid-year questions available; answers enterable per Super Scooper |
| T5 | One chronological notes feed with author name + date; authorized roles can add |
| T6 | Invite parent/coach from profile with view + notes access; minimal setup friction |
| T7 | Promotion cert questions loaded from Admin templates, not hardcoded arrays |

---

## 9. Next actions

1. **Schedule design review** (§6) before starting T3/T4/T5/T6 development.  
2. **Obtain Google Doc** with five mid-year questions.  
3. **Complete T1 Replit check** and decide fix.  
4. **Merge / deploy T2** (accommodations PR) when ready.  
5. **Lock sequence** (Option A recommended).  
6. After design review: write short tech spec for T3-A, then implement.

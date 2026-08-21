# Work packets — Cursor (Architect) → Replit (Implementer)

Paste one packet at a time into Replit. Do not implement from this repo’s Cursor Cloud agent unless product explicitly overrides the working model.

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

## Later packets (not ready)

| Packet | Topic | Blocked by |
|--------|--------|------------|
| PACKET-003 | T3-A form builder | Design review + §4 decisions |
| PACKET-004 | T4 mid-year questions | Google Doc + PACKET-003 |
| PACKET-005 | T5 unified notes | Product decisions §4 |
| PACKET-006 | T6 lightweight invites | Notes model + access decisions |
| PACKET-007 | T7 migrate cert checklists | PACKET-003 |

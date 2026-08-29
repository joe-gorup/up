---
name: Collaborative assessment sessions
description: How multi-user concurrent assessment works (Option B — presence indicator + join, no hard locks)
---

## Rule
When an employee already has an active assessment session, other users see a banner ("X is already assessing — Join session") instead of a hard block. Joining = adopting the existing session ID in frontend state, no new session created.

**Why:** Users requested collaborative documentation over a locking/takeover model. Hard locks were reverted. The session lock is kept as the coordination primitive (one session per employee), but writes are open to any authenticated user.

## How to apply
- `GET /api/employees/:id/lock-status` is the source of truth. It returns: `locked`, `ownSession`, `sessionId`, `location`, `ownerName`, `lockedAt`, `expiresAt`, `activeDocumenters[]`.
- `activeDocumenters` = distinct `documenter_user_id` values from `step_progress` in the last 20 min for this session, excluding the session owner.
- Frontend polls this endpoint every 15 s while in assessmentMode (EmployeeProgress.tsx) to show a presence badge ("Also here: Name1, Name2").
- EmployeeDetail.tsx fetches lock-status once on load (not in assessment mode) to decide whether to show "Join session" or "Start Assessment".
- The session owner still renews the lock via the renew endpoint. Joiners do not renew — they just write step_progress using the existing session ID.
- `apiRequest` signature in client: `apiRequest(url: string, options?: RequestInit)` — NOT `(method, url)`.

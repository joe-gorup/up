# Mid-Year Review Questions — Locked Content (F1)

**Source:** Mid-year review PDF (Allison / Sarah / Super Scooper meetings)  
**Locked:** August 23, 2026  
**Status:** Ready to seed as form template after PACKET-003A / 003B  
**Blocks:** PACKET-004 only (engine work proceeds without this)

---

## Template metadata

| Field | Value |
|-------|--------|
| Template name | Mid-Year Review |
| `form_type` | `mid_year_review` |
| Cycle label (example) | `2026-mid-year` |
| Who fills | Administrator, Shift Lead (default) |
| Who views | Staff by default; Guardians / Job Coaches only if `form_responses` View enabled |

---

## Questions (6 — not 5)

Original email said “five questions.” The working document has **six**. Use all six.

| # | `stable_key` | Prompt | Type | Required | Notes |
|---|--------------|--------|------|----------|-------|
| 1 | `task_independence` | How independently does the employee begin and complete assigned tasks? | **`scale`** (1–5) + **`long_text`** comment | Yes (scale); comment optional | Meeting notes use numeric ratings + narrative |
| 2 | `communication` | Does the employee communicate effectively and respectfully with coworkers, managers, and customers? | **`scale`** (1–5) + **`long_text`** comment | Yes (scale); comment optional | |
| 3 | `self_advocacy` | Does the employee appropriately advocate for themselves when they need help, clarification, coaching, or additional support? | **`scale`** (1–5) + **`long_text`** comment | Yes (scale); comment optional | |
| 4 | `feedback_acceptance` | How well does the employee accept feedback, follow directions, and redo tasks when work does not meet expectations? | **`scale`** (1–5) + **`long_text`** comment | Yes (scale); comment optional | |
| 5 | `job_duty_consistency` | Does the employee complete all assigned job duties consistently and according to expected standards? | **`scale`** (1–5) + **`long_text`** comment | Yes (scale); comment optional | |
| 6 | `milestones_celebrated` | What milestones, improvements, or accomplishments should be celebrated from the first half of the year? | **`long_text`** | Yes | Free-form only (no scale in source data) |

### Scale config (questions 1–5)

```json
{
  "min": 1,
  "max": 5,
  "labels": {
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5"
  }
}
```

**UI recommendation:** Rating control (1–5) with an optional “Notes” textarea under each rated question. Implement as either:
- One `scale` question + linked optional `long_text` follow-up, or  
- A single compound field if the engine supports `scale_with_comment` later  

For PACKET-004 seed with current types: use **`scale`** + separate **`long_text`** per item (keys `task_independence_notes`, etc.) unless Phase 1 already supports comment-on-scale.

### Exact prompt strings (copy-paste for seed)

1. How independently does the employee begin and complete assigned tasks?
2. Does the employee communicate effectively and respectfully with coworkers, managers, and customers?
3. Does the employee appropriately advocate for themselves when they need help, clarification, coaching, or additional support?
4. How well does the employee accept feedback, follow directions, and redo tasks when work does not meet expectations?
5. Does the employee complete all assigned job duties consistently and according to expected standards?
6. What milestones, improvements, or accomplishments should be celebrated from the first half of the year?

---

## Data entry note (Allison)

Collected meeting answers already exist in the PDF (per employee: score + notes + often goals G1/G2/…).  

**v1 form scope:** the six review questions above.  

**Goals (G1, G2, …)** in the PDF are separate from these review questions — enter via existing Goal Assignment / development goals, not as mid-year form fields, unless product later adds a “goals discussion” section to the template.

---

## Implication for form engine types

`scale` (1–5) is **required for mid-year**, not optional Phase 4 fluff.  

→ Include working **`scale`** renderer in **PACKET-003A** (or no later than 003B before PACKET-004 seed).

---

## Employees with answers in source PDF (for data-entry backlog)

John, Wendy, Connor, Emma, Hank, Sam, Hilda, Kailyn, Heather, Jill, Kathryn, Bella, KC, Mitch, Thomas, Charlie, Jacob, Annie, Ali, Emmett, Nicholas, Jack Mayor Murphy  

(Match to Super Scooper profiles by name when entering; do not invent IDs here.)

---
name: Form response snapshots
description: Preserve completed form meaning when reusable templates are edited later.
---

Form responses must carry and render from a template snapshot captured when the response is created. Answer-level question snapshots are useful audit data, but they are not enough for rendering a complete historical response after sections or questions change.

**Why:** Reusable forms change over time. Rendering a submitted response from the latest template can hide former questions or alter the review record after the fact.

**How to apply:** Any future form-versioning, response export, or historical response UI should prefer the response snapshot; only draft or legacy records without a snapshot may fall back to the current template.
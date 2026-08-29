---
name: Database schema sync
description: Prevent development schema changes from being applied to a database other than the one the running app uses.
---

Keep schema changes aligned with the database connection used by the running application.

**Why:** A secondary connection can point at a different database, leaving the active app without an otherwise successfully applied additive column.

**How to apply:** Confirm a running app query can read a newly added field after synchronizing its schema.
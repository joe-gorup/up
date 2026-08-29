---
name: Workflow stale skill paths
description: Recovery guidance when workflow APIs fail on deleted temporary skill directories.
---

Workflow listing, restart, log, and validation APIs can fail before reaching the app when their external file index retains deleted `.local/skills/.tmp-*` paths. Recreating the paths, including continuously during restart, does not repair the index because the workflow service uses a separate snapshot.

**Why:** The project filesystem and direct `rg --files` can both be clean while every managed workflow API still reports the same deleted temporary paths.

**How to apply:** Do not alter app or workflow configuration and do not delete `.local`. Confirm the app directly with its port, then use Replit's **Restart compute** command to clear the external index before retrying managed workflow operations.
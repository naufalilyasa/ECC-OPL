---
description: Compatibility wrapper for the unified /e2e map interface; retained during migration only
argument-hint: "[path or route scope]"
---

# `/e2e-map` — compatibility wrapper

This public command is retained for migration only. It is a thin wrapper with **no independent
mapping procedure and no registry write instructions**. All route detection, journey grouping,
locale deduplication and reconciliation behaviour lives in the internal reusable resource used by
`/e2e map` and `/e2e full`:

`.opencode/resources/e2e-journey-mapper.md`

On invocation, forward the request to the unified interface exactly:

```
/e2e map $ARGUMENTS
```

Do not perform a separate discovery, do not load the legacy write instructions, and never write
`TESTS.md` or `.governance/docs-map.json` from this wrapper. Any registry proposal must go through
`/e2e` and the deterministic registry tool. Do not disable or delete this wrapper before parity is
verified and explicit P5 deployment authorization is granted.

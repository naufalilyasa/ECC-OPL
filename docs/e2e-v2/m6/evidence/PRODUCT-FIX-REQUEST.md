# E2E-V2-M5-SAFETY-REMEDIATION-01

Separate owner authorization required. M5 writer `applyFieldScopedUpdate` must reject
invalid canonical `State` values (including `stale`) before any text mutation, and
`checkRegistryPathSafety` must reject a nonexistent child beneath an outside-pointing
symlink ancestor. No M5 source was modified by M6-R1.1.

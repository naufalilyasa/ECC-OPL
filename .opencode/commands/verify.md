---
description: Run verification loop to validate implementation
agent: build
---

# Verify Command

Run verification loop to validate the implementation: $ARGUMENTS

## Your Task

Execute comprehensive verification:

1. **Type Check**: `npx tsc --noEmit`
2. **Lint**: `npm run lint`
3. **Unit Tests**: `npm test`
4. **Integration Tests**: `npm run test:integration` (if available)
5. **Build**: `npm run build`
6. **Coverage Check**: Verify 80%+ coverage

## Verification Checklist

### Code Quality
- [ ] No TypeScript errors
- [ ] No lint warnings
- [ ] No console.log statements
- [ ] Functions < 50 lines
- [ ] Files < 800 lines

### Tests
- [ ] All tests passing
- [ ] Coverage >= 80%
- [ ] Edge cases covered
- [ ] Error conditions tested

### Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] No SQL injection risks
- [ ] No XSS vulnerabilities

### Build
- [ ] Build succeeds
- [ ] No warnings
- [ ] Bundle size acceptable

## Binding (optional work-item persistence)

```bash
WI=""
for R in "$CLAUDE_PLUGIN_ROOT" \
         "${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}" \
         "./.agents" "." "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; do
  [ -n "$R" ] && [ -f "$R/scripts/lib/work-item/work-item.js" ] && { WI="$R/scripts/lib/work-item/work-item.js"; break; }
done
# TASK_SLUG is this task's identity, not the last active pointer.
TASK_SLUG="<kebab-slug-of-this-task>"
if [ -z "$WI" ]; then echo "work-item helper not found — running standalone (legacy paths)"; MODE=standalone
elif [ "$ECC_OPL_STANDALONE" = "1" ] || [ "${1:-}" = "--standalone" ]; then echo "legacy paths (explicit opt-out)"; MODE=standalone
elif [ -n "$EXPLICIT_ID" ]; then ITEM=$(node "$WI" bind --id "$EXPLICIT_ID") || exit 1; MODE=bound
else ITEM=$(node "$WI" bind --slug "$TASK_SLUG") || exit 1; MODE=bound; fi
[ "$MODE" = "bound" ] && echo "bound: $ITEM -> .ecc-opl/work-items/$ITEM"
```

Legacy paths apply only under the two explicit opt-outs above; a missing pointer is not one.
When bound, write the report to `.ecc-opl/work-items/<ITEM>/implementation/verify-<date>.md`
and append it with `--outcome pass|fail`.

## Verification Report

### Summary
- Status: PASS: PASS / FAIL: FAIL
- Score: X/Y checks passed

### Details
| Check | Status | Notes |
|-------|--------|-------|
| TypeScript | PASS:/FAIL: | [details] |
| Lint | PASS:/FAIL: | [details] |
| Tests | PASS:/FAIL: | [details] |
| Coverage | PASS:/FAIL: | XX% (target: 80%) |
| Build | PASS:/FAIL: | [details] |

### Action Items
[If FAIL, list what needs to be fixed]

---

**NOTE**: Verification loop should be run before every commit and PR.

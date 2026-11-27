---
description: Update codemaps for codebase navigation
---

# Update Codemaps Command

Update codemaps to reflect current codebase structure: $ARGUMENTS

## Your Task

Generate or update codemaps in `docs/CODEMAPS/` directory:

1. **Analyze codebase structure**
2. **Generate component maps**
3. **Document relationships**
4. **Update navigation guides**

## Codemap Types

### Architecture Map
```
docs/CODEMAPS/ARCHITECTURE.md
```
- High-level system overview
- Component relationships
- Data flow diagrams

### Module Map
```
docs/CODEMAPS/MODULES.md
```
- Module descriptions
- Public APIs
- Dependencies

### File Map
```
docs/CODEMAPS/FILES.md
```
- Directory structure
- File purposes
- Key files

## Codemap Format

### [Module Name]

**Purpose**: [Brief description]

**Location**: `src/[path]/`

**Key Files**:
- `file1.ts` - [purpose]
- `file2.ts` - [purpose]

**Dependencies**:
- [Module A]
- [Module B]

**Exports**:
- `functionName()` - [description]
- `ClassName` - [description]

**Usage Example**:
```typescript
import { functionName } from '@/module'
```

## Generation Process

1. Scan directory structure
2. Parse imports/exports
3. Build dependency graph
4. Generate markdown maps
5. Validate links

## Work-item Mode (bound runs)

`docs/CODEMAPS/` is authoritative and stays put. When `.ecc-opl/active` names a work item
(and neither `--standalone` nor `ECC_OPL_STANDALONE=1` is set), also write the run summary to
`.ecc-opl/work-items/<ITEM>/documentation/<date>-codemaps.md` and
`node <helper> append --workflow update-codemaps --artifact summary --path <file>`.
Resolve the helper across `$CLAUDE_PLUGIN_ROOT`,
`${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}`, `./.agents`, `.`,
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. No bound item: unchanged behaviour.

---

**TIP**: Keep codemaps updated when adding new modules or significant refactoring.

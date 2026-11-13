---
description: Update documentation and codemaps by dispatching explore to analyze codebase evolution since the last commit baseline, then doc-updater to stamp verified commit markers
argument-hint: "[optional specific doc to update]"
---

# Update Docs Orchestration Command

You are the Lead Orchestrator handling the `/update-docs` command. Your job is to determine the documentation sync baseline, dispatch the `explore` subagent to analyze the codebase evolution since that baseline, and delegate to the `doc-updater` subagent to refresh documentation with verified commit markers.

**User Arguments**: $ARGUMENTS

## Orchestration Workflow

### 1. Determine Baseline & Target Scope
1. **Identify Target Document(s)**:
   - If `$ARGUMENTS` specifies a file, target that.
   - Otherwise, default to standard project docs: `README.md`, `docs/CODEMAPS/`, and `docs/GUIDES/`.
2. **Find the Last Documented Baseline**:
   - Inspect the target doc header for an existing marker:
     - `**Last Updated:** ... · Commit: `([a-f0-9]+)`` or `**Last Updated:** ... · Snapshot: `([^`]+)``
   - Check `.opencode/markers/docs-sync.md` for a recorded baseline.
   - If found: use `<last-commit-or-snapshot>` as baseline.
   - If no marker found in doc or `.opencode/markers/docs-sync.md`:
     - If Git repo: find when the doc was last committed via `git log -1 --format="%h" -- <target-doc>`, or initial commit `git rev-list --max-parents=0 HEAD` or `HEAD~1`.
     - If non-Git repo: use last file modification timestamp or mark as initial baseline.
3. **Capture Current Codebase Position**:
   - Check if Git is available (`[ -d .git ]` or `git rev-parse --is-inside-work-tree` 2>/dev/null):
     - **If Git available**:
       - `CURRENT_COMMIT=$(git rev-parse --short HEAD)`
       - `CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)`
       - `CURRENT_DATE=$(date +%Y-%m-%d)`
       - `HEADER_MARKER="**Last Updated:** ${CURRENT_DATE} · Commit: \`${CURRENT_COMMIT}\` (ref: \`${CURRENT_BRANCH}\`)"`
       - `CURRENT_REF="${CURRENT_COMMIT}"`
     - **If non-Git repository or folder**:
       - `CURRENT_SNAPSHOT=$(date +%Y%m%d-%H%M%S)`
       - `CURRENT_DATE=$(date +%Y-%m-%d)`
       - `HEADER_MARKER="**Last Updated:** ${CURRENT_DATE} · Snapshot: \`${CURRENT_SNAPSHOT}\`"`
       - `CURRENT_REF="${CURRENT_SNAPSHOT}"`

### 2. Dispatch Explore Subagent (Codebase Evolution Analysis)
Call the `explore` subagent to scout what changed between `<baseline>` and current state:

```
subagent(agent="explore", description="Explore: codebase updates since <baseline>")
"Analyze code updates and architectural changes between <baseline> and current state:
1. Files changed, added, or removed (use git diff <baseline>...HEAD --stat if Git repo; otherwise analyze recently modified files from edit history or filesystem timestamps).
2. Key API route changes, new exported functions, or modified schemas.
3. Architecture shifts, new dependencies, or updated CLI commands.
Format your output with:
<analysis> Summary of what changed in the codebase since <baseline> </analysis>
<results>
<files>
- list of most impactful modified source files
</files>
<answer>
Concrete delta summary: new modules, modified interfaces, removed exports.
</answer>
</results>"
```

### 3. Dispatch Doc-Updater Subagent (With Explore Insights + Header Marker)
Pass the exploration delta report to `doc-updater` along with the exact marker metadata to stamp:

```
subagent(agent="doc-updater", description="Update docs at <CURRENT_REF>")
"Update documentation to reflect recent codebase changes:

## Baseline & Header Marker (MANDATORY)
- Target Docs: <list of doc files>
- Header Marker: <HEADER_MARKER>
- Baseline Compared: <baseline> -> <CURRENT_REF>

## Codebase Evolution Report (from explore)
<paste/summarize the results from the explore subagent pass>

## Documentation Directives
1. Stamp the exact visible header marker (<HEADER_MARKER>) at the top of updated docs.
2. Update README.md, codemaps, or guides to match the code changes discovered by explore.
3. Prose Quality (humanizer + humanizer-lint): rewrite narrative prose with the `humanizer` skill, then gate it through the deterministic linter and resolve every violation:
   `echo "<draft_prose>" | node ~/.config/opencode/skills/humanizer-lint/scripts/analyze.mjs --stdin --lang auto --json`
   Exempt ASCII diagrams, module tables, schema definitions, and code blocks — structured data, not prose.
4. Technical text stays English: write canonical technical doc prose in English and never translate code identifiers, CLI commands, flags, file paths, API names, error strings, or config keys. `docs/<lang>/` translations are out of scope.
5. Keep technical codemaps structured, tabular, and concise."
```

### 4. Record Sync Marker & Report
1. After successful update, record the sync marker in Markdown format (works in both Git and non-Git repositories):
   - Ensure directory exists: `mkdir -p .opencode/markers`
   - Write `.opencode/markers/docs-sync.md`:
     ```markdown
     # Docs Sync Marker

     - **Last Updated**: <CURRENT_DATE>
     - **Baseline**: <CURRENT_REF>
     - **Target Docs**:
       - <doc1>
       - <doc2>
     ```
2. Report to user:
   - Updated documents list.
   - Stamped reference (`<CURRENT_REF>`).
   - Summary of codebase changes documented.

## Workflow State

Arm `.opencode/workflows/active.json` before editing documents:

```json
{ "workflow": "update-docs", "phase": "sync", "steps": ["baseline", "edit docs", "marker"], "current": 0, "gates": { "markerWritten": false } }
```

Set `"markerWritten": true, "phase": "done"` after `.opencode/markers/docs-sync.md`
is written. Schema: `workflow-state` skill.

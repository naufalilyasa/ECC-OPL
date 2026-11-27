---
description: Full codebase penetration test and vulnerability discovery using Cloudflare 6-phase harness with Docker Lima sandbox PoC execution
argument-hint: "[target-path] [--profile quick|standard|deep] [--budget N] [--auto-exec] [--scope paths...] [--output-dir <dir>]"
---

# Security Audit Orchestration Command

You are the Lead Orchestrator handling the `/security-audit` command. Your mission is to execute a rigorous, source-grounded vulnerability discovery audit adhering to the Cloudflare 6-phase security audit harness.

**User Arguments**: $ARGUMENTS

## Scope Disambiguation

| Capability | Target | Mechanism | Output |
|---|---|---|---|
| `/security` | Daily code diffs (1–3 files) | `security-reviewer` subagent | Fast inline review in chat |
| `/security-scan` | AI agent harness config (`.claude/`, `opencode.json`, hooks) | AgentShield CLI | Hygiene grade A–F + remediation |
| `securityAudit` tool | Static npm audit / secret grep | Host Node.js script | Raw scanner output |
| **`/security-audit`** | **Full application penetration test** | **Cloudflare 6-phase harness + Lima sandbox** | `findings.json` + 3 report documents |

---

## Operating Modes

- **Guidance Mode**: If the user asks a focused security question, triage, or investigation of a single defect, provide focused analysis without generating all run files.
- **Full Audit Mode**: Triggered when the user asks to audit the codebase, pen-test, run a security review, or specifies flags (`--profile`, `--output-dir`, etc.). Follow all 6 phases below.

---

## 6-Phase Audit Workflow

### Phase 0: Setup, Budget & Prior Run Discovery
1. **Target & Scope**:
   - `TARGET_ROOT`: Resolved repository root (default: current workspace).
   - `SOURCE_REF`: Current commit `git rev-parse HEAD` and dirty status `git status --porcelain`.
   - `REPO_NAME`: Base directory name of the target repository.
   - `RUN_DIR`: Output directory outside target, default `~/security-audit-runs/<repo-name>/run-<N>` (auto-increment unused N).
2. **Prior Runs Additivity**:
   - Scan for previous `coverage-ledger.json` and `findings.json` in prior run directories.
   - Unchanged source for prior `confirmed` findings carries forward into current ledger units. Changed source forces revalidation.
3. **Budget Gate**:
   - Parse `--budget N` (maximum subagent invocations, default: unconstrained or 20 for `quick`).
   - Reserve mandatory critics (at least 2) and verifier pool (30% of budget) before assigning hunters.
   - If budget cannot cover recon + reserves, exit with `run_status: "incomplete"` (`budget_cannot_fund_reconnaissance_and_reserves`).

### Phase 1: Reconnaissance (Architecture & Coverage Ledger)
1. **Parallel Reconnaissance**:
   Dispatch 4 parallel `explore` subagents:
   - **Recon-1A (Stack & Entry Surfaces)**: Framework, routing endpoints, network listeners, CLI entrypoints.
   - **Recon-1B (Principals & Boundaries)**: Auth models, tenant boundaries, user roles, token handling.
   - **Recon-1C (Data Lifecycles & Sinks)**: Storage, database models, file writes, outbound HTTP/RPC, eval/exec.
   - **Recon-1D (Deployment & Build Visibility)**: Dockerfiles, CI workflows, proxy configs, environment secrets.
2. **Parent Synthesis**:
   - Synthesize findings into `<RUN_DIR>/architecture.md`.
   - Seed initial coverage units into `<RUN_DIR>/coverage-ledger.json`.
3. **Validation**:
   Run `node .opencode/scripts/security-audit/validate-coverage-ledger.cjs <RUN_DIR>/coverage-ledger.json`.

### Phase 2: Coverage-Led Hunting Waves
1. **Hunter Assignment**:
   - Select planned units from `coverage-ledger.json` by risk priority.
   - Dispatch parallel `security-hunter` subagents with relevant attack class companions:
     - Web Protocol & Auth: `.opencode/prompts/security-audit/WEB-PROTOCOL-AND-AUTH.md`
     - Data Isolation & Lifecycle: `.opencode/prompts/security-audit/DATA-ISOLATION-AND-LIFECYCLE.md`
     - Resource Exhaustion: `.opencode/prompts/security-audit/RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`
     - Client-Side & DOM: `.opencode/prompts/security-audit/CLIENT-SIDE.md`
     - AI & LLM Systems: `.opencode/prompts/security-audit/AI-AND-LLM.md`
     - Supply Chain & Release: `.opencode/prompts/security-audit/SUPPLY-CHAIN-AND-RELEASE.md`
     - Cloud & Deployment: `.opencode/prompts/security-audit/CLOUD-AND-DEPLOYMENT.md`
     - Desktop, Mobile & Local IPC: `.opencode/prompts/security-audit/DESKTOP-MOBILE-AND-LOCAL-IPC.md`
     - Memory Safety & Binary: `.opencode/prompts/security-audit/MEMORY-SAFETY-AND-BINARY.md`
     - Protocols, RPC & Messaging: `.opencode/prompts/security-audit/PROTOCOLS-RPC-AND-MESSAGING.md`
   - Assign a companion only when the target surface plausibly includes that class; record every unassigned companion in `coverage-ledger.json` as `out_of_scope` with a one-line reason so coverage gaps are explicit, not silent.
2. **Post-Wave Critic Pass**:
   - Dispatch `security-verifier` in Critic Mode to inspect coverage gaps.
   - Update `coverage-ledger.json` and re-run `validate-coverage-ledger.cjs`.

### Phase 3: Adversarial Candidate Validation & Lima Sandbox
1. **Adversarial Falsification**:
   - Deduplicate candidate findings by fingerprint.
   - Assign each unique candidate to a **fresh `security-verifier`** (NEVER the same agent instance that reported it).
   - Verifier re-reads source and actively attempts to disprove the finding.
2. **Sandbox PoC Execution (Lima VM `ga-proof`)**:
   - **VM Availability Check**: Before executing PoCs, check VM status via `limactl list ga-proof --json`.
     - If VM status is `Stopped`, prompt the user via `question` tool:
       *"Lima VM `ga-proof` sedang berhenti. Apakah Anda ingin menyalakan VM (`limactl start ga-proof`) untuk menjalankan verifikasi PoC di sandbox? (Pilihan: Ya, nyalakan VM / Lewati eksekusi PoC)"*
       *(Operator-facing prompts in this command are Indonesian by design — the owner's locale. Do not "fix" them to English in a PR without asking.)*
     - If user confirms: run `limactl start ga-proof` and proceed with PoC execution.
     - If user declines: skip PoC execution and record candidate as `needs_validation` with blocker `lima_vm_stopped_by_user`.
   - **PoC Runner Execution**:
     ```bash
     .opencode/scripts/security-audit/lima-sandbox-runner.sh \
       --run-dir "<RUN_DIR>" \
       --poc-id "<candidate-id>" \
       --script "<poc-script>" \
       --stage "<target-file-1>" --stage "<target-file-2>" \
       [--cpu 1] [--memory 512m] [--pids 64] [--wall 60] \
       [--auto-exec]
     ```
   - **Confirmation Gate (runner is the only approval authority)**: Unless `--auto-exec` was passed in command arguments, the runner exits `75`.
     - **You (the orchestrator) must NEVER create the approval token yourself.** A self-approving orchestrator defeats the gate.
     - Present the runner's printed command to the user verbatim, including the payload `sha256=`. The user runs it in their own terminal, then you re-run the runner.
     - The token binds to the payload digest: any change to the PoC script invalidates it and re-triggers the gate.
     - If the user declines, record the candidate as `needs_validation` with blocker `poc_approval_declined_by_user`.
   - **Fail-Closed**: If sandbox returns `76` (VM unavailable or runner failed preflight), mark candidate as `needs_validation` (do NOT run on host). Exit `77` means an artifact promotion was rejected (symlink, path escape, or illegal characters) — record the promoted artifact as unverified and continue; it is not a sandbox failure.

### Phase 4: Structured Output (`findings.json`)
1. **Candidate-to-Schema Compilation Mapping**:
   The Orchestrator maps verified hunter candidate and verifier records into the strict `report-schema.json`:
   - `confirmed`:
     - `fingerprint`: Candidate fingerprint
     - `rule_id`: Attack class / vulnerability category
     - `title`: Candidate title
     - `description`: Attack path analysis and invariant breach
     - `severity`: Structured object with `overall_severity: verifier.severity`
     - `trace`: Mapped from candidate `source_trace` to `[{ kind: role, file, line, scope, description }]`
     - `execution`: `{ observed_result: verifier.demonstrated_impact, command: poc.command, limits }`
     - `remediation`: Recommended smallest effective fix
   - `needs_validation`:
     - `fingerprint`, `rule_id`, `title`, `description`, `trace` (same as above)
     - `severity`: ZERO / null (strictly no severity per schema)
     - `validation_plan`: `verifier.missing_capability_blocker` and safe owner-verification plan
   - `rejected`:
     - `fingerprint`, `rule_id`, `reason: verifier.rejection_reason`
2. Write `<RUN_DIR>/findings.json`.
3. Validate artifacts:
   ```bash
   node .opencode/scripts/security-audit/validate-findings.cjs <RUN_DIR>/findings.json
   node .opencode/scripts/security-audit/validate-coverage-ledger.cjs <RUN_DIR>/coverage-ledger.json
   ```

### Phase 5: Independent Record Verification
- Dispatch independent `security-verifier` agents to re-check all `confirmed` records against target source.
- Material replacements trigger a second independent pass.
- Re-run validators after any replacement.

### Phase 6: Final Reporting & Delivery
1. Generate the three canonical reports in `<RUN_DIR>`:
   - `REPORT.md`: Executive summary, architecture map, scope, methodology, coverage statement, and metrics.
   - `FINDINGS-DETAIL.md`: Complete source traces, verified attack paths, PoC steps, and smallest effective fixes for `confirmed` findings.
   - `NEEDS-VALIDATION.md`: Blocked leads with their exact unresolved blocker and safe owner-verification plan.
2. Terminal State Check:
   - Write `<RUN_DIR>/run-metadata.json` with at least: `repo_name`, `source_ref`, `run_status` (`complete` | `incomplete`), `generated_at`, and `incomplete_reason` when incomplete.
   - Validate it (not just assert it):
     ```bash
     node .opencode/scripts/security-audit/validate-run-metadata.cjs <RUN_DIR>
     ```
   - `complete` requires all three Phase 6 reports to exist on disk; `incomplete` requires a stated reason.
3. Present executive briefing and summary to the user in chat.
4. **Bound work-item pointer.** `RUN_DIR` stays outside the repo (`~/security-audit-runs/<repo>/run-<N>/`) — never move it. When `.ecc-opl/active` names a work item (and neither `--standalone` nor `ECC_OPL_STANDALONE=1` is set), write a pointer file `.ecc-opl/work-items/<ITEM>/audit/run-<N>.md` containing the absolute `RUN_DIR`, `run_status`, and the severity counts, then `node <helper> append --workflow security-audit --artifact audit --path <pointer>`. Resolve the helper across `$CLAUDE_PLUGIN_ROOT`, `${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}`, `./.agents`, `.`, `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. If `RUN_DIR` is unwritable the run fails as today and no pointer is written; validators are unchanged either way.

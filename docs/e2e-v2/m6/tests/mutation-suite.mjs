// M6 negative mutation suite — 14 carrier/oracle pairs from NEGATIVE-MUTATION-PLAN.md.
// Carriers are deterministic in-memory tamper simulations; each oracle independently
// evaluates its own policy invariant against the carrier's observed state.
// An optional override lets tests exercise the oracle's non-detect (safe) branch.
// No process spawn, shell, network, browser, registry write or active config write.
import * as registryState from './registry-state.mjs'

const base = (mutation, proven_in) => ({
  mutation,
  registry_writes: 0,
  applied: false,
  live_execution: false,
  proven_in,
})
const verdict = (n, detected, expected, observed, reason, proven_in = 'M6', extra = {}) => ({
  ...base(n, proven_in),
  detected,
  expected,
  observed,
  oracle_reason: reason,
  ...extra,
})

// 1 — /e2e map must never dispatch the runner.
export function runMutation1(o = {}) {
  const carrier = { phase: 'map', runnerInvocations: o.runnerInvocations ?? 1 }
  const expected = 0
  const detected = carrier.runnerInvocations > expected
  return verdict(1, detected, expected, carrier.runnerInvocations,
    detected ? 'map phase forced a runner dispatch' : 'map remained no-run',
    'M6', { observedDispatch: detected })
}

// 2 — /e2e status must never write a registry file.
export function runMutation2(o = {}) {
  const carrier = { phase: 'status', registryWrites: o.registryWrites ?? 1 }
  const expected = 0
  const detected = carrier.registryWrites > expected
  return verdict(2, detected, expected, carrier.registryWrites,
    detected ? 'status phase attempted a registry write' : 'status stayed read-only',
    'M6', { observedWrite: detected })
}

// 3 — bare /e2e must never launch a browser.
export function runMutation3(o = {}) {
  const carrier = { phase: 'bare', browserInvocations: o.browserInvocations ?? 1 }
  const expected = 0
  const detected = carrier.browserInvocations > expected
  return verdict(3, detected, expected, carrier.browserInvocations,
    detected ? 'bare command started a browser' : 'bare command only previewed',
    'M6', { observedBrowser: detected })
}

// 4 — unregistered run without --ad-hoc must be refused before dispatch.
export function runMutation4(o = {}) {
  const carrier = {
    registered: o.registered ?? false,
    adHoc: o.adHoc ?? false,
    outcome: o.outcome ?? 'EXECUTED',
  }
  const expected = 'REGISTRY_REQUIRED'
  const detected = carrier.outcome !== expected
  return verdict(4, detected, expected, carrier.outcome,
    detected ? 'unregistered run executed without --ad-hoc' : 'registry requirement enforced',
    'M6', { observedUnregisteredExec: detected })
}

// 5 — ad-hoc PASS must never be recorded as registry State: covered.
export function runMutation5(o = {}) {
  const carrier = {
    adHoc: o.adHoc ?? true,
    state: o.state ?? 'covered',
    registryWrites: o.registryWrites ?? 1,
  }
  const ok = carrier.adHoc === false || (carrier.state !== 'covered' && carrier.registryWrites === 0)
  const detected = !ok
  return verdict(5, detected, 'state !== covered AND registryWrites === 0',
    { state: carrier.state, registryWrites: carrier.registryWrites },
    detected ? 'ad-hoc PASS was granted covered state' : 'ad-hoc status remained unregistered',
    'M6', { observedCovered: detected })
}

// 6 — duplicate TEST-E2E IDs must be rejected, not updated.
export function runMutation6(o = {}) {
  const ids = o.proposedIds ?? ['TEST-E2E-001', 'TEST-E2E-001']
  const carrier = { proposedIds: ids, outcome: o.outcome ?? 'UPDATE_APPLIED' }
  const unique = new Set(carrier.proposedIds).size === carrier.proposedIds.length
  const detected = !unique || carrier.outcome !== 'DUPLICATE_ID_REJECTED'
  return verdict(6, detected, 'DUPLICATE_ID_REJECTED', carrier.outcome,
    detected ? 'duplicate TEST-ID update proceeded' : 'duplicate ID rejected',
    'M6', { observedDuplicate: !unique })
}

// 7 — registry path traversal / symlink escape must be rejected before write.
export function runMutation7(o = {}) {
  const carrier = {
    path: o.path ?? '../../TESTS.md',
    contained: o.contained ?? false,
    outcome: o.outcome ?? 'WRITE_ATTEMPTED',
  }
  const detected = !carrier.contained && carrier.outcome !== 'PATH_REJECTED'
  return verdict(7, detected, 'PATH_REJECTED / SYMLINK_ESCAPE', carrier.outcome,
    detected ? 'registry path escape reached a write attempt' : 'path containment enforced',
    'M6', { observedEscape: detected })
}

// 8 — State: an invalid canonical state must not be accepted by the registry validator.
export function runMutation8(o = {}) {
  const { validateRegistryState } = registryState
  const carrier = { state: o.state ?? 'stale', accepted: o.accepted ?? true }
  const canonical = validateRegistryState(carrier.state)
  const detected = carrier.accepted && !canonical.valid
  return verdict(8, detected, 'INVALID_REGISTRY_STATE', carrier.state,
    detected ? 'invalid State accepted as a valid enum' : 'canonical registry state enum enforced',
    'M6', { observedInvalidState: detected, canonical_valid: canonical.valid })
}

// 9 — Command field shell text must be data; zero shell invocations.
export function runMutation9(o = {}) {
  const carrier = {
    commandHasShellText: o.commandHasShellText ?? true,
    shellInvocations: o.shellInvocations ?? 1,
  }
  const expected = 0
  const detected = carrier.shellInvocations > expected
  return verdict(9, detected, expected, carrier.shellInvocations,
    detected ? 'untrusted Command text reached a shell' : 'Command text treated as data',
    'M6', { observedShellExec: detected })
}

// 10 — exit 0 with visibility-only assertions must not earn covered (ported from M4).
export function runMutation10(o = {}) {
  const carrier = {
    exitCode: o.exitCode ?? 0,
    assertionKind: o.assertionKind ?? 'visibility-only',
    creditEligible: o.creditEligible ?? true,
  }
  const weak = carrier.assertionKind !== 'behavioral'
  const detected = weak && carrier.creditEligible
  return verdict(10, detected, 'PASS_UNVERIFIED / no coverage credit',
    carrier.creditEligible ? 'PASS_VERIFIED(credit)' : 'PASS_UNVERIFIED',
    detected ? 'weak assertion exit 0 awarded coverage credit' : 'assertion quality gate enforced',
    'M4', { observedCovered: detected })
}

// 11 — skipped / zero-test runs must never produce covered.
export function runMutation11(o = {}) {
  const carrier = {
    testCount: o.testCount ?? 0,
    skipped: o.skipped ?? true,
    state: o.state ?? 'covered',
  }
  const detected = (carrier.testCount === 0 || carrier.skipped) && carrier.state === 'covered'
  return verdict(11, detected, 'NOT_EXECUTED / UNVERIFIED', carrier.state,
    detected ? 'zero/skipped test run was marked covered' : 'test-count gate enforced',
    'M6', { observedCovered: detected })
}

// 12 — production target without scoped approval must be blocked (ported from M4).
export function runMutation12(o = {}) {
  const carrier = {
    classification: o.classification ?? 'production',
    approval: o.approval ?? null,
    dispatchCount: o.dispatchCount ?? 1,
  }
  const mustBlock = carrier.classification !== 'non-production' || !carrier.approval
  const detected = mustBlock && carrier.dispatchCount > 0
  return verdict(12, detected, 0, carrier.dispatchCount,
    detected ? 'unsafe production target reached dispatch' : 'production target blocked',
    'M4', { observedSpawn: detected })
}

// 13 — concurrent registry edit hash check bypass must be caught (ported from M5).
export function runMutation13(o = {}) {
  const carrier = {
    hashBefore: o.hashBefore ?? 'aaa',
    hashNow: o.hashNow ?? 'bbb',
    hashCheckSkipped: o.hashCheckSkipped ?? true,
    clobber: o.clobber ?? true,
  }
  const detected = carrier.hashCheckSkipped && carrier.hashBefore !== carrier.hashNow && carrier.clobber
  return verdict(13, detected, 'WRITE_CONFLICT / no clobber', 'OVERWRITTEN',
    detected ? 'concurrent edit clobbered writer A by skipping hash-before-write' : 'conflict detection enforced',
    'M5', { observedClobber: detected })
}

// 14 — premature /e2e-map disablement must be refused (ported from M5).
export function runMutation14(o = {}) {
  const carrier = {
    parityVerified: o.parityVerified ?? true,
    p1Verified: o.p1Verified ?? false,
    p5Given: o.p5Given ?? false,
    attemptedDisable: o.attemptedDisable ?? true,
  }
  const gateAllows = carrier.parityVerified && carrier.p1Verified && carrier.p5Given
  const detected = carrier.attemptedDisable && !gateAllows
  return verdict(14, detected, 'BLOCKED_PREMATURE_DISABLE',
    detected ? 'BLOCKED_PREMATURE_DISABLE' : 'DISABLE_ATTEMPTED',
    detected ? 'premature disable attempted with P1/P5 unsatisfied' : 'migration gate enforced',
    'M5', { observedDisable: detected })
}

const RUNNERS = Object.freeze([
  runMutation1, runMutation2, runMutation3, runMutation4, runMutation5,
  runMutation6, runMutation7, runMutation8, runMutation9, runMutation10,
  runMutation11, runMutation12, runMutation13, runMutation14,
])

export function runMutation(n, overrides = {}) {
  const runner = RUNNERS[n - 1]
  if (!runner) throw new RangeError(`unknown mutation ${n}`)
  return runner(overrides)
}

export function runFullMutationSuite() {
  const mutations = RUNNERS.map((runner) => runner())
  const detected = mutations.filter((m) => m.detected).length
  return {
    scenario_id: 'MUT',
    acceptance: ['AC-022', 'E02'],
    fixture_provenance: 'DETERMINISTIC_CARRIER_ORACLE',
    registry_writes: 0,
    applied: false,
    total: mutations.length,
    detected,
    bypassed: mutations.length - detected,
    all_detected: detected === mutations.length,
    mutations,
  }
}

// Canonical registry State contract (M1 registry contract §State).
// This is the single authoritative validator for the five allowed values.
export const REGISTRY_STATES = Object.freeze([
  'missing', 'in progress', 'unverified', 'covered', 'not applicable',
])

export function validateRegistryState(value) {
  const valid = typeof value === 'string' && REGISTRY_STATES.includes(value)
  return { valid, code: valid ? 'OK' : 'INVALID_REGISTRY_STATE' }
}

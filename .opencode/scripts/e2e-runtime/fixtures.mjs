// Runtime subset of M6 fixtures — copied validated taxonomy, no machine paths.
import { resolve } from 'node:path'
export const ROOT = resolve(process.env.E2E_REPO_ROOT ?? '.')
export const SCENARIO_IDS = Object.freeze([
  ...['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08'],
  ...Array.from({ length: 12 }, (_, i) => 'B' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 12 }, (_, i) => 'C' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 10 }, (_, i) => 'D' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 6 }, (_, i) => 'E' + String(i + 1).padStart(2, '0')),
])
const set = (...ids) => new Set(ids)
export const EXECUTED_PASS_IDS = Object.freeze(set(
  'C04', 'C05', 'C06', 'C07', 'C10', 'D02', 'D05',
  'E01', 'E02', 'E03', 'E04', 'E05', 'E06',
))
export const REFERENCE_VERIFIED_IDS = Object.freeze(set(
  ...['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07'],
  ...Array.from({ length: 12 }, (_, i) => 'B' + String(i + 1).padStart(2, '0')),
  'C01', 'C02', 'C03', 'C08', 'C09', 'C11', 'C12',
  'D01', 'D03', 'D04', 'D06', 'D07', 'D08', 'D09', 'D10',
))
export const NOT_RUN_IDS = Object.freeze(set('A08'))


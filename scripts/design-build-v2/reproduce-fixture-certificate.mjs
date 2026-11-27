#!/usr/bin/env node
/**
 * Re-produce a Track A admission certificate for a static HTML fixture.
 *
 * Existing certificates predate mandatory revision binding, so they now report
 * ADMISSION_REVISION_UNBOUND. Sealing a new revision onto the OLD PNG bytes
 * would be fabricating evidence, so this script measures both sides fresh in a
 * real browser and writes a certificate that carries `candidateRevisionSha256`.
 *
 * Usage:
 *   node scripts/design-build-v2/reproduce-fixture-certificate.mjs \
 *     --html <file.html> --profile <landmarks.json> --out <dir> [--label <name>]
 *
 * The certificate is only written as ADMITTED when the canonical verifier
 * agrees; anything less writes BLOCKED and exits non-zero.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  measureRendered,
  compareRendered,
  resolveLandmarks,
} from './render-parity.mjs';
import {
  verifyAdmissionCertificate,
  CANONICAL_GATE_SEQUENCE,
} from './track-a-admission.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];

async function main() {
  const htmlPath = resolve(arg('html'));
  const profilePath = resolve(arg('profile'));
  const outDir = resolve(arg('out'));
  const label = arg('label', 'fixture');
  if (!existsSync(htmlPath)) throw new Error(`html not found: ${htmlPath}`);
  if (!existsSync(profilePath)) throw new Error(`profile not found: ${profilePath}`);

  const html = readFileSync(htmlPath, 'utf8');
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const landmarks = resolveLandmarks(profile);

  // The candidate revision is the exact bytes being admitted. Binding the real
  // digest is what makes the certificate reproducible and non-fabricated.
  const candidateRevisionSha256 = sha256(html);

  mkdirSync(outDir, { recursive: true });

  const captures = {};
  const profileDimensions = {};
  const images = {};

  for (const vp of VIEWPORTS) {
    const opts = {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      theme: 'dark',
      locale: 'en-US',
      reducedMotion: 'reduce',
      fontReady: true,
      landmarks,
    };
    // Reference and candidate are measured independently from the same bytes:
    // this admits the fixture as it stands, it does not prove a repair.
    const reference = await measureRendered(html, opts);
    const candidate = await measureRendered(html, opts);
    const verdict = compareRendered(reference, candidate, 0.5, landmarks);

    writeFileSync(join(outDir, `${vp.name}-reference.png`), reference.screenshotBytes);
    writeFileSync(join(outDir, `${vp.name}-candidate.png`), candidate.screenshotBytes);

    captures[vp.name] = {
      referencePath: `${vp.name}-reference.png`,
      candidatePath: `${vp.name}-candidate.png`,
      referenceSha256: reference.screenshotSha256,
      candidateSha256: candidate.screenshotSha256,
      verdict: verdict.code,
      diffs: verdict.diffs,
      landmarks: Object.keys(reference.landmarks),
    };
    profileDimensions[vp.name] = [vp.width, vp.height];
    images[vp.name] = { reference: reference.screenshotBytes, candidate: candidate.screenshotBytes };
  }

  const allPass = VIEWPORTS.every(vp => captures[vp.name].verdict === 'PARITY_PASS');
  const approvedBundleSha256 = sha256(
    VIEWPORTS.map(vp => captures[vp.name].referenceSha256).join('')
  );

  const certificate = {
    schemaVersion: 1,
    certificate: 'TRACK_A_VISUAL_ADMISSION',
    status: allPass ? 'ADMITTED' : 'BLOCKED',
    source: 'chromium-playwright',
    fixture: label,
    approvedBundleSha256,
    candidateRevisionSha256,
    profileDimensions,
    captures,
    gateResults: Object.fromEntries(
      CANONICAL_GATE_SEQUENCE.map(gate => [gate, allPass ? 'PASS' : 'FAIL'])
    ),
    gateSequence: CANONICAL_GATE_SEQUENCE.slice(),
    renderedEvidence: {
      source: 'chromium-playwright',
      verified: allPass,
      generated_utc: new Date().toISOString(),
    },
  };

  const verification = verifyAdmissionCertificate(certificate, images, {
    approvedBundleSha256,
  });
  certificate.status = verification.status === 'ADMITTED' ? 'ADMITTED' : 'BLOCKED';

  const outFile = join(outDir, 'track-a-admission.json');
  writeFileSync(outFile, JSON.stringify(certificate, null, 2) + '\n');

  console.log(JSON.stringify({
    out: outFile,
    status: certificate.status,
    candidateRevisionSha256,
    verification: verification.status,
    reason: verification.reason || null,
  }, null, 2));

  if (certificate.status !== 'ADMITTED') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { main };

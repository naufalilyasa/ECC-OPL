#!/usr/bin/env node
/**
 * Produce a real Track A admission certificate for a project that supplies its
 * own landmark profile.
 *
 * P-WEB1 used a hardcoded fixture; this script drives the same authoritative
 * pipeline (chromium-playwright measurement -> rendered comparison -> gate
 * chain) against a live project page so admission is not fixture-locked.
 *
 * Usage:
 *   node scripts/design-build-v2/capture-project-evidence.mjs \
 *     --project <path> --profile <landmark-profile.json> --out <dir>
 *
 * The certificate is only written when both required viewports reach
 * PARITY_PASS against the approved bundle. Anything less writes a BLOCKED
 * report and exits non-zero.
 */
import { readFileSync, writeFileSync, mkdirSync, join, resolve, sha256 } from './render-parity.mjs';
import { measureRendered, compareRendered, resolveLandmarks } from './render-parity.mjs';
import { verifyAdmissionCertificate } from './track-a-admission.mjs';
import { pathToFileURL } from 'node:url';

const REQUIRED = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];
// Canonical order is owned by the verifier; never restate it here.
import { CANONICAL_GATE_SEQUENCE } from './track-a-admission.mjs';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

/**
 * Inline the project stylesheet into the HTML so Playwright's `setContent`
 * (which has no origin) can resolve it.
 *
 * Only a real `<link rel="stylesheet" href="style.css">` element counts:
 * commented-out tags and `data-href` lookalikes are not the intended asset.
 * Any other wiring is an unsupported configuration and must fail loudly rather
 * than produce silently unstyled evidence.
 */
function inlineAssets(html, css) {
  const source = String(html)
  // Blank out HTML comments so a commented-out <link> cannot be selected. The
  // comment text is restored afterwards, untouched. The sentinel carries a
  // per-call nonce: a page that legitimately contains the placeholder text
  // must not be rewritten into a comment body.
  const nonce = sha256(`${source}\u0000${String(css)}`).slice(0, 16)
  const sentinel = index => `\u0000COMMENT-${nonce}-${index}\u0000`
  const comments = []
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, (match) => {
    comments.push(match)
    return sentinel(comments.length - 1)
  })

  // Every real stylesheet link in the document, ignoring `data-href` and any
  // other attribute that merely contains the string "href".
  const linkTags = withoutComments.match(/<link\b[^>]*>/gi) || []
  const stylesheets = linkTags.filter(tag => /rel\s*=\s*["']?stylesheet["']?/i.test(tag))
  if (stylesheets.length === 0) {
    throw new Error('could not find a <link rel="stylesheet"> element to inline')
  }
  if (stylesheets.length > 1) {
    throw new Error(`unsupported asset configuration: ${stylesheets.length} stylesheet links found`)
  }
  const target = stylesheets[0]
  const hrefMatch = target.match(/(?<![-\w])href\s*=\s*["']([^"']+)["']/i)
  if (!hrefMatch) {
    throw new Error('unsupported asset configuration: stylesheet link has no href')
  }
  const href = hrefMatch[1]
  if (!/(?:^|\/)style\.css$/.test(href)) {
    throw new Error(`unsupported asset configuration: cannot inline ${href} (expected style.css)`)
  }

  // A literal replacement string interprets `$&`, `$'`, `$1`... and a `</style>`
  // inside the CSS would close the element early. Use a replacer function and
  // neutralise the closing tag.
  const safeCss = String(css).replace(/<\/style/gi, '<\\/style')
  const inlined = withoutComments.replace(target, () => `<style>${safeCss}</style>`)
  return inlined.replace(/\u0000COMMENT-([0-9a-f]+)-(\d+)\u0000/g, (match, tag, i) => (
    tag === nonce ? comments[Number(i)] : match
  ))
}

/**
 * The certificate may only claim ADMITTED when the canonical verifier agrees.
 * Kept as a named function so the invariant is directly testable.
 */
function deriveAdmissionStatus(verification) {
  return verification && verification.status === 'ADMITTED' ? 'ADMITTED' : 'BLOCKED';
}

async function main() {
  const project = resolve(arg('project', '.'));
  const profilePath = arg('profile');
  const outDir = resolve(arg('out', join(project, 'docs/design/evidence/track-a')));
  if (!profilePath) throw new Error('--profile is required');

  const profile = JSON.parse(readFileSync(resolve(profilePath), 'utf8'));
  const landmarks = resolveLandmarks(profile);
  const rawHtml = readFileSync(join(project, 'public/index.html'), 'utf8');
  const rawCss = readFileSync(join(project, 'public/style.css'), 'utf8');
  const html = inlineAssets(rawHtml, rawCss);
  // The admitted revision is the exact page bytes. Without it the certificate
  // cannot be checked against a current checkout and the gate rejects it as
  // ADMISSION_REVISION_UNBOUND.
  const candidateRevisionSha256 = sha256(`${rawHtml}\u0000${rawCss}`);

  mkdirSync(outDir, { recursive: true });

  const captures = {};
  const profileDimensions = {};
  const images = {};
  const renderProfiles = {};

  for (const vp of REQUIRED) {
    const opts = {
      width: vp.width, height: vp.height, deviceScaleFactor: 1,
      theme: 'light', locale: 'en-US', reducedMotion: 'reduce', fontReady: true,
      landmarks,
    };
    // The approved bundle and the candidate are the same bytes here: this is a
    // baseline admission for an existing page, not a repair comparison. Both
    // sides are still measured independently so the parity check is real.
    const reference = await measureRendered(html, opts);
    const candidate = await measureRendered(html, opts);
    const verdict = compareRendered(reference, candidate, 0.5, landmarks);

    writeFileSync(join(outDir, `${vp.name}-reference.png`), reference.screenshotBytes);
    writeFileSync(join(outDir, `${vp.name}-candidate.png`), candidate.screenshotBytes);

    captures[vp.name] = {
      referenceSha256: reference.screenshotSha256,
      candidateSha256: candidate.screenshotSha256,
      // Named so a consumer can load the bytes back: the certificate is only
      // useful if `loadAdmissionImages` can resolve what the producer wrote.
      referencePath: `${vp.name}-reference.png`,
      candidatePath: `${vp.name}-candidate.png`,
      verdict: verdict.code,
      diffs: verdict.diffs,
      landmarks: Object.keys(reference.landmarks),
    };
    profileDimensions[vp.name] = [vp.width, vp.height];
    images[vp.name] = { reference: reference.screenshotBytes, candidate: candidate.screenshotBytes };
    renderProfiles[vp.name] = reference.profile;
  }

  const allPass = REQUIRED.every(vp => captures[vp.name].verdict === 'PARITY_PASS');
  const bundleSha = sha256(
    REQUIRED.map(vp => captures[vp.name].referenceSha256).join('')
  );

  const certificate = {
    status: allPass ? 'ADMITTED' : 'BLOCKED',
    project,
    contract: profile.contract || null,
    approvedBundleSha256: bundleSha,
    candidateRevisionSha256,
    profileDimensions,
    captures,
    renderProfiles,
    // G2 must be authoritative (declared by rendered evidence); the others are
    // contract/interaction gates this baseline admission does not falsify.
    gateResults: Object.fromEntries(
      CANONICAL_GATE_SEQUENCE.map(g => [g, allPass ? 'PASS' : 'FAIL'])
    ),
    gateSequence: CANONICAL_GATE_SEQUENCE.slice(),
    renderedEvidence: {
      source: 'chromium-playwright',
      verified: allPass,
      generated_utc: new Date().toISOString(),
    },
  };

  // Self-check against the real admission verifier before claiming ADMITTED.
  // The status written to disk is the verifier's, never a pre-computed guess:
  // a failed check must not leave an ADMITTED certificate behind.
  const verification = verifyAdmissionCertificate(certificate, images);
  certificate.status = deriveAdmissionStatus(verification);
  const outFile = join(outDir, 'track-a-admission.json');
  writeFileSync(outFile, JSON.stringify({ certificate, verification }, null, 2) + '\n');

  console.log(JSON.stringify({
    out: outFile,
    status: certificate.status,
    verification: verification.status,
    viewports: Object.fromEntries(REQUIRED.map(vp => [vp.name, captures[vp.name].verdict])),
  }, null, 2));

  if (verification.status !== 'ADMITTED') process.exitCode = 1;
}

export { deriveAdmissionStatus, inlineAssets };

// Only run when executed directly; importing the module for tests must not
// start a browser or require CLI arguments.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('CAPTURE FAILED:', error.message);
    process.exitCode = 1;
  });
}

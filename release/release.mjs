#!/usr/bin/env node
// release/release.mjs — Orchestrator for the @esheet/* release pipeline.
//
// Usage:
//   node release/release.mjs [--dry-run]
//
// Env vars (provided automatically by GitHub Actions):
//   GH_TOKEN                        — for `gh release create`
//   ACTIONS_ID_TOKEN_REQUEST_URL    — OIDC provenance (id-token: write)
//   ACTIONS_ID_TOKEN_REQUEST_TOKEN  — OIDC provenance (id-token: write)

import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { PACKAGES } from './config.mjs';
import { run, exec, tryRun } from './utils.mjs';
import { getCommits, determineBump, applyBump } from './commits.mjs';
import { buildEntry, prependChangelog } from './changelog.mjs';
import { bumpAll, readPkg } from './versions.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const bumpArg = process.argv.find((a) => a.startsWith('--bump='));
const MANUAL_BUMP = bumpArg ? bumpArg.split('=')[1] : null;

// ---------------------------------------------------------------------------
// 1. Resolve current version from last tag
// ---------------------------------------------------------------------------

const lastTag = tryRun('git describe --tags --abbrev=0');
const tagVersion = lastTag ? lastTag.replace(/^v/, '') : null;
const pkgVersion = readPkg('packages/core').version;

// If a previous prerelease bumped package.json without creating a tag,
// the tag is stale. Prefer the package.json version when it's strictly
// ahead of the last tag so the prerelease counter increments correctly.
function isVersionAhead(pkg, tag) {
  if (!tag) return true;
  // If pkg contains a pre-release suffix, compare the base parts first.
  const [pkgBase] = pkg.split('-');
  const [tagBase] = tag.split('-');
  const pkgParts = pkgBase.split('.').map(Number);
  const tagParts = tagBase.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pkgParts[i] > tagParts[i]) return true;
    if (pkgParts[i] < tagParts[i]) return false;
  }
  // Same base: pkg is ahead only if it has a prerelease suffix (tag doesn't)
  return pkg.includes('-') && !tag.includes('-');
}

const currentVersion =
  tagVersion && !isVersionAhead(pkgVersion, tagVersion)
    ? tagVersion
    : pkgVersion;

console.log(`Last tag:        ${lastTag || '(none)'}`);
console.log(`Package version: ${pkgVersion}`);
console.log(`Current version: ${currentVersion}  ${currentVersion === pkgVersion && tagVersion ? '(from package.json — ahead of tag)' : '(from tag)'}`);

// ---------------------------------------------------------------------------
// 2. Collect + parse conventional commits since last tag
// ---------------------------------------------------------------------------

const commits = getCommits(lastTag, currentVersion);

if (!commits.length) {
  console.log('No conventional commits found — nothing to release.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 3. Determine semver bump and compute new version
// ---------------------------------------------------------------------------

// --bump is required for dispatch; PR merge auto-detects from conventional commits.
const bump = MANUAL_BUMP ?? determineBump(commits) ?? 'patch';

if (!MANUAL_BUMP) {
  console.log(`Auto-detected bump: ${bump} (from conventional commits)`);
}

const newVersion = applyBump(currentVersion, bump);
const IS_PRERELEASE = newVersion.includes('-');

// ---------------------------------------------------------------------------
// Version regression guard — prevent the bot from committing a downgrade.
// Compares newVersion against the live package.json version so a re-run that
// somehow computes a lower version fails loudly instead of silently pushing.
// ---------------------------------------------------------------------------

function versionGt(a, b) {
  const parseParts = (v) => {
    const [base, pre] = v.split('-');
    const nums = base.split('.').map(Number);
    // No prerelease suffix is "higher" than any prerelease suffix on same base.
    const preNum = pre === undefined ? Infinity : Number(pre);
    return [...nums, preNum];
  };
  const pa = parseParts(a);
  const pb = parseParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

if (!versionGt(newVersion, pkgVersion)) {
  console.error(
    `\n❌  Version regression detected!\n` +
      `   Computed : ${newVersion}\n` +
      `   package.json : ${pkgVersion}\n` +
      `   The new version must be strictly greater than the current package.json version.\n` +
      `   This can happen when the last git tag is stale after a prerelease.\n` +
      `   Aborting to prevent the bot from pushing a downgraded version.`
  );
  process.exit(1);
}

console.log(`\nBump:        ${bump}`);
console.log(
  `New version: ${newVersion}${IS_PRERELEASE ? '  [PRERELEASE]' : ''}${
    DRY_RUN ? '  [DRY RUN]' : ''
  }\n`
);

// ---------------------------------------------------------------------------
// 4. Bump all package.json versions
// ---------------------------------------------------------------------------

bumpAll(newVersion, DRY_RUN);

// ---------------------------------------------------------------------------
// 5. Build all packages (dist/ must reflect the new version before publish)
// ---------------------------------------------------------------------------

const pkgNames = PACKAGES.map((p) => readPkg(p).name).join(',');

if (DRY_RUN) {
  console.log(`\n[DRY RUN] Would build: ${pkgNames}`);
} else {
  console.log('\nBuilding packages...');
  exec(`npx nx run-many -t build --projects=${pkgNames} --skip-nx-cache`);
}

// ---------------------------------------------------------------------------
// 6. Generate and write CHANGELOG entry (skipped for prereleases)
// ---------------------------------------------------------------------------

const changelogEntry = buildEntry(newVersion, commits);

if (IS_PRERELEASE) {
  console.log('[PRERELEASE] Skipping CHANGELOG update.');
} else {
  console.log('--- CHANGELOG ENTRY ---');
  console.log(changelogEntry + '---\n');

  if (!DRY_RUN) {
    prependChangelog(changelogEntry);
    console.log('✍  CHANGELOG.md updated');
  }
}

// ---------------------------------------------------------------------------
// 7. npm publish --provenance (OIDC trusted publishing)
//    Done BEFORE the git push so that if publish fails, nothing lands on main.
// ---------------------------------------------------------------------------

for (const pkgDir of PACKAGES) {
  const pkg = readPkg(pkgDir);
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would publish ${pkg.name}@${newVersion}`);
    continue;
  }
  console.log(`\nPublishing ${pkg.name}@${newVersion}...`);
  const publishTag = IS_PRERELEASE ? '--tag next' : '';
  exec(`npm publish --provenance --access public ${publishTag}`.trim(), {
    cwd: pkgDir,
  });
}

// ---------------------------------------------------------------------------
// 8. Git commit + tag + push — only reached if publish succeeded above.
//    (prereleases: no tag, no changelog in commit)
// ---------------------------------------------------------------------------

if (DRY_RUN) {
  console.log(
    `[DRY RUN] Would commit${
      IS_PRERELEASE ? '' : `, tag v${newVersion},`
    } and push`
  );
} else if (IS_PRERELEASE) {
  const changedFiles = PACKAGES.map((p) => `${p}/package.json`).join(' ');
  run(`git add ${changedFiles} package-lock.json`);
  run(`git commit -m "chore(release): bump to ${newVersion} [prerelease]"`);
  run('git push origin main');
  console.log(`📦 Committed version bumps for ${newVersion} (no tag)`);
} else {
  const changedFiles = PACKAGES.map((p) => `${p}/package.json`).join(' ');
  run(`git add ${changedFiles} CHANGELOG.md package-lock.json`);
  run(`git commit -m "chore(release): publish ${newVersion}"`);
  run(`git tag v${newVersion}`);
  run('git push origin main');
  run(`git push origin v${newVersion}`);
  console.log(`🏷  Tagged and pushed v${newVersion}`);
}

// ---------------------------------------------------------------------------
// 9. GitHub Release (skipped for prereleases; tag must be on remote first)
// ---------------------------------------------------------------------------

if (IS_PRERELEASE) {
  console.log('[PRERELEASE] Skipping GitHub release creation.');
} else {
  // Strip the heading line — gh uses the tag as the release title.
  const releaseNotes = changelogEntry.replace(/^## .+\n/, '').trim();
  const notesFile = join(tmpdir(), 'esheet-release-notes.md');

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would create GitHub release v${newVersion}`);
  } else {
    writeFileSync(notesFile, releaseNotes);
    exec(
      `gh release create v${newVersion} --title "v${newVersion}" --notes-file "${notesFile}"`
    );
    console.log(`📦 GitHub release v${newVersion} created`);
  }
}

console.log(`\n✅  Released v${newVersion}`);

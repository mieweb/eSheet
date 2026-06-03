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
const currentVersion = lastTag
  ? lastTag.replace(/^v/, '')
  : readPkg('packages/core').version;

console.log(`Last tag:        ${lastTag || '(none)'}`);
console.log(`Current version: ${currentVersion}`);

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
// 7. Git commit + tag + push (prereleases: no tag, no changelog in commit)
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
// 8. GitHub Release (skipped for prereleases)
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

// ---------------------------------------------------------------------------
// 9. npm publish --provenance (OIDC trusted publishing)
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

console.log(`\n✅  Released v${newVersion}`);

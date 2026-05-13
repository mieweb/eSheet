// release/versions.mjs — read/write package.json version fields.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PACKAGES } from './config.mjs';

export function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

export function writePkg(dir, pkg) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}

/** Collect the set of package names that are part of this monorepo release. */
function publishedNames() {
  return new Set(PACKAGES.map((p) => readPkg(p).name));
}

/** Update any dep/peerDep/devDep references to sibling packages. */
function bumpSiblingRefs(pkg, names, newVersion) {
  for (const depField of ['dependencies', 'peerDependencies', 'devDependencies']) {
    if (!pkg[depField]) continue;
    for (const name of Object.keys(pkg[depField])) {
      if (names.has(name)) {
        pkg[depField][name] = newVersion;
      }
    }
  }
}

/**
 * Update the version field in every package's package.json,
 * and update cross-package dependency references so they all stay in sync.
 * @param {string} newVersion
 * @param {boolean} dryRun
 */
export function bumpAll(newVersion, dryRun) {
  const names = publishedNames();

  // Collect all package dirs to update: publishable packages + any workspace
  // package that references a sibling (e.g. apps/demo).
  const allDirs = [...PACKAGES, 'apps/demo'];

  for (const pkgDir of allDirs) {
    if (dryRun) {
      if (PACKAGES.includes(pkgDir)) {
        console.log(`[DRY RUN] Would update ${pkgDir}/package.json → ${newVersion}`);
      }
      continue;
    }
    const pkg = readPkg(pkgDir);
    if (PACKAGES.includes(pkgDir)) {
      pkg.version = newVersion;
    }
    bumpSiblingRefs(pkg, names, newVersion);
    writePkg(pkgDir, pkg);
    if (PACKAGES.includes(pkgDir)) {
      console.log(`✍  ${pkgDir}/package.json → ${newVersion}`);
    }
  }
}

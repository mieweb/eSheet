// release/versions.mjs — read/write package.json version fields.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PACKAGES } from './config.mjs';

/** Collect the set of @esheet/* package names from the workspace. */
function getEsheetPackageNames() {
  return new Set(PACKAGES.map((dir) => readPkg(dir).name));
}

export function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

export function writePkg(dir, pkg) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Update the version field in every package's package.json.
 * Also pins cross-package @esheet/* dependencies to the new version
 * so published packages don't resolve "*" to the old stable release.
 * @param {string} newVersion
 * @param {boolean} dryRun
 */
export function bumpAll(newVersion, dryRun) {
  const esheetNames = getEsheetPackageNames();
  for (const pkgDir of PACKAGES) {
    if (dryRun) {
      console.log(
        `[DRY RUN] Would update ${pkgDir}/package.json → ${newVersion}`
      );
      continue;
    }
    const pkg = readPkg(pkgDir);
    pkg.version = newVersion;

    // Pin cross-package @esheet/* deps so published packages reference
    // the exact prerelease version instead of resolving "*" to latest stable.
    for (const depField of ['dependencies', 'peerDependencies', 'devDependencies']) {
      if (!pkg[depField]) continue;
      for (const depName of Object.keys(pkg[depField])) {
        if (esheetNames.has(depName)) {
          pkg[depField][depName] = newVersion;
        }
      }
    }

    writePkg(pkgDir, pkg);
    console.log(`✍  ${pkgDir}/package.json → ${newVersion}`);
  }
}

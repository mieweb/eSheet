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

/**
 * Update the version field in every package's package.json.
 * @param {string} newVersion
 * @param {boolean} dryRun
 */
export function bumpAll(newVersion, dryRun) {
  for (const pkgDir of PACKAGES) {
    if (dryRun) {
      console.log(
        `[DRY RUN] Would update ${pkgDir}/package.json → ${newVersion}`
      );
      continue;
    }
    const pkg = readPkg(pkgDir);
    pkg.version = newVersion;
    writePkg(pkgDir, pkg);
    console.log(`✍  ${pkgDir}/package.json → ${newVersion}`);
  }
}

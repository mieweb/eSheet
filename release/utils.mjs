// release/utils.mjs — shell execution helpers.

import { execSync } from 'child_process';

/** Run a command and return trimmed stdout. Throws on non-zero exit. */
export function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', ...opts }).trim();
}

/** Run a command with live stdout/stderr (no return value). Throws on non-zero exit. */
export function exec(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

/** Run a command and return trimmed stdout, or empty string on any failure. */
export function tryRun(cmd) {
  try {
    return run(cmd);
  } catch {
    return '';
  }
}

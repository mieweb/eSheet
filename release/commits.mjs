// release/commits.mjs — parse conventional commits and determine semver bump.

import { tryRun } from './utils.mjs';
import { BUMP_RULES } from './config.mjs';

// type(scope)!?: message (#PR)
const COMMIT_RE = /^(\w+)(\(([^)]+)\))?(!)?: (.+?)(?:\s+\(#(\d+)\))?$/;

/**
 * Parse a single conventional commit subject line.
 * Returns null if it doesn't match the format.
 */
function parseSubject(hash, subject) {
  const m = subject.match(COMMIT_RE);
  if (!m) return null;
  return {
    hash,
    type: m[1],
    scope: m[3] ?? null,
    breaking: !!m[4],
    message: m[5].trim(),
    pr: m[6] ?? null,
  };
}

/**
 * Return all conventional commits since `lastTag`.
 * If lastTag is empty, falls back to resolving `v${currentVersion}` as a ref.
 * If that also fails (truly no tags), returns all commits.
 * @returns {{ hash, type, scope, breaking, message, pr }[]}
 */
export function getCommits(lastTag, currentVersion) {
  let range;
  if (lastTag) {
    range = `${lastTag}..HEAD`;
  } else {
    // git describe failed (tag not fetched locally) — try the version tag directly
    const fallbackTag = `v${currentVersion}`;
    const resolved = tryRun(`git rev-parse --verify ${fallbackTag}`);
    range = resolved ? `${fallbackTag}..HEAD` : 'HEAD';
  }
  const raw = tryRun(`git log ${range} --pretty=format:"%H|||%s"`);
  if (!raw) return [];

  return raw
    .split('\n')
    .map((line) => {
      const sep = line.indexOf('|||');
      return parseSubject(
        line.slice(0, sep).trim(),
        line.slice(sep + 3).trim()
      );
    })
    .filter(Boolean);
}

/**
 * Determine the semver bump level from a list of parsed commits.
 * Respects adjustSemverBumpsForZeroMajorVersion (breaking ! → minor when major=0).
 * @returns {'minor' | 'patch' | null}  null means no releasable commits
 */
export function determineBump(commits) {
  let bump = null;
  for (const c of commits) {
    const level = c.breaking ? 'minor' : BUMP_RULES[c.type] ?? null;
    if (level === 'minor') return 'minor';
    if (level === 'patch') bump = 'patch';
  }
  return bump;
}

/**
 * Apply a bump to a semver string and return the new version.
 * @param {string} current e.g. "0.0.2"
 * @param {'minor' | 'patch'} bump
 */
export function applyBump(current, bump) {
  const [maj, min, pat] = current.split('.').map(Number);
  return bump === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
}

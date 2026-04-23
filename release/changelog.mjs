// release/changelog.mjs — generate a CHANGELOG.md entry from parsed commits.

import { readFileSync, writeFileSync } from 'fs';
import {
  REPO,
  SECTION_ORDER,
  SECTION_TITLES,
  HIDDEN_TYPES,
} from './config.mjs';

/**
 * Build the markdown text for a single release entry.
 * @param {string} version  e.g. "0.0.3"
 * @param {object[]} commits  parsed commits from commits.mjs
 * @returns {string}
 */
export function buildEntry(version, commits) {
  const today = new Date().toISOString().slice(0, 10);
  const sections = {};

  for (const c of commits) {
    if (HIDDEN_TYPES.has(c.type)) continue;
    if (!SECTION_TITLES[c.type]) continue;
    if (!sections[c.type]) sections[c.type] = [];

    let line = '- ';
    if (c.scope) line += `**${c.scope}:** `;
    line += c.message;
    if (c.pr) line += ` ([#${c.pr}](https://github.com/${REPO}/pull/${c.pr}))`;
    sections[c.type].push(line);
  }

  let entry = `## ${version} (${today})\n`;
  for (const type of SECTION_ORDER) {
    if (!sections[type]?.length) continue;
    entry += `\n${SECTION_TITLES[type]}\n\n`;
    entry += sections[type].join('\n') + '\n';
  }

  return entry + '\n';
}

/**
 * Prepend `entry` to the existing CHANGELOG.md.
 * @param {string} entry  output of buildEntry()
 */
export function prependChangelog(entry) {
  const existing = readFileSync('CHANGELOG.md', 'utf8');
  writeFileSync('CHANGELOG.md', entry + existing);
}

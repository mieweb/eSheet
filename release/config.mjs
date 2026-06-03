// release/config.mjs — shared constants for the release pipeline.

export const REPO = 'mieweb/eSheet';

/** Publishable packages in dependency order (dependencies before dependents). */
export const PACKAGES = [
  'packages/core',
  'packages/fields',
  'packages/adapters',
  'packages/renderer',
  'packages/builder',
  'packages/renderer-blaze',
  'packages/renderer-standalone',
];

/** Conventional commit type → semver bump level. */
export const BUMP_RULES = {
  feat: 'minor',
  enhance: 'patch',
  fix: 'patch',
  perf: 'patch',
};

/** Ordered list of types that appear in the changelog. */
export const SECTION_ORDER = [
  'feat',
  'fix',
  'enhance',
  'perf',
  'refactor',
  'docs',
];

/** Human-readable headings per commit type. */
export const SECTION_TITLES = {
  feat: '### 🚀 Features',
  fix: '### 🐛 Bug Fixes',
  enhance: '### ✨ Enhancements',
  perf: '### ⚡ Performance',
  refactor: '### ♻️ Refactoring',
  docs: '### 📚 Documentation',
};

/** Commit types that are never shown in the changelog. */
export const HIDDEN_TYPES = new Set(['test', 'chore', 'ci', 'build', 'repo']);

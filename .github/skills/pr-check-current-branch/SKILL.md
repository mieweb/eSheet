---
name: pr-check-current-branch
description: Run a local PR check for the current branch using the CI workflow contract (format:check + run-many lint/test/build/typecheck), then produce a concise review-ready pass/fail report. USE WHEN user asks "check this branch", "run PR checks", "verify against ci.yml", "pre-PR validation", or "ci check locally".
---

# PR Check Current Branch

Use this skill to validate the current branch with a local workflow that mirrors `.github/workflows/ci.yml`.

## Default Flow

1. Confirm branch: `git branch --show-current`
2. Refresh CI base ref: `git fetch origin main`
3. Install deps exactly like CI: `npm ci`
4. Run format gate: `npx nx format:check --base="remotes/origin/main"`
5. Run task gate: `npx nx run-many -t lint test build typecheck`
6. Produce a concise PASS/FAIL report with failed command details.

## Report Template

```markdown
## Branch PR Check

Branch: {branch}
Status: PASS | FAIL

Checks:

- npx nx format:check --base="remotes/origin/main" => PASS|FAIL
- npx nx run-many -t lint test build typecheck => PASS|FAIL

Failure summary:

- {None | first failure and key error lines}
```

## Optional Fast Mode (non-authoritative)

Use only if user asks for a quick pre-check:

```bash
npx nx affected -t lint test build typecheck --base=remotes/origin/main --head=HEAD
```

Then clearly label output as pre-check, not full CI-equivalent validation.

## Guardrails

- CI-equivalent mode is the default and authoritative.
- Do not substitute direct tool commands for Nx tasks.
- Do not skip `npm ci` unless user explicitly asks to skip install.
- If `remotes/origin/main` is missing/stale, fetch before format check.

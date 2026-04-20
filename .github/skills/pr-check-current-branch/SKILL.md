---
name: pr-check-current-branch
description: Run a local PR check for the current branch using the CI workflow contract (format:check + run-many lint/test/build/typecheck), then produce a concise review-ready pass/fail report. USE WHEN user asks "check this branch", "run PR checks", "verify against ci.yml", "pre-PR validation", or "ci check locally".
---

# PR Check Current Branch

Use **`gh act`** to validate the current branch against the exact `.github/workflows/ci.yml` contract.
This is the canonical local CI/CD method — see `.github/workflows/TESTING-LOCALLY.md` for full details.

## Default Flow

1. Confirm branch: `git branch --show-current`
2. Refresh CI base ref: `git fetch origin main --depth=1`
3. Run CI workflow via gh act:
   ```bash
   gh act push -W .github/workflows/ci.yml --pull=false
   ```
   - Omit `--pull=false` only on the very first ever run (to pull the runner image).
   - On all subsequent runs always include `--pull=false` to avoid Docker Hub rate-limiting.
4. Produce a concise PASS/FAIL report from the gh act output.

## Report Template

```markdown
## Branch PR Check

Branch: {branch}
Status: PASS | FAIL

Checks:

- gh act push -W .github/workflows/ci.yml --pull=false => PASS|FAIL

Failure summary:

- {None | first failing step and key error lines}
```

## Fallback (no Docker / gh act unavailable)

Only when `gh act` is explicitly unavailable, fall back to manual steps and label the output
as **non-authoritative pre-check**:

1. `npx nx format:check --base="remotes/origin/main"` — if it fails, run `npx nx format --base="remotes/origin/main"` then recheck
2. `npx nx run-many -t lint test build typecheck --outputStyle=static`

## Guardrails

- `gh act` is the authoritative method. Do not use manual `nx run-many` chains as a CI equivalent by default.
- Do NOT run `npm ci` locally — it wipes node_modules and breaks locked native binaries on Windows. Use `npm install` to repair deps in place if needed.
- If `remotes/origin/main` is missing/stale, fetch before running.
- Always check `.github/workflows/TESTING-LOCALLY.md` for workflow-specific flags and troubleshooting.

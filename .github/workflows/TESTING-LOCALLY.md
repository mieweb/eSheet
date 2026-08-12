# Local Workflow Testing with gh act

Use `gh act` to validate the GitHub Actions workflows locally. The commands below match the active workflows in this directory.

## Prerequisites

- `gh` CLI installed and authenticated
- `gh act` available
- Docker running
- Node.js 24 or newer

The first `gh act` run may need to pull the runner image. After that, use `--pull=false` to reuse the cached image.

## CI

Run the pull request quality gate:

```bash
gh act pull_request -W .github/workflows/ci.yml --pull=false
```

The workflow enables the pinned pnpm version, installs with `--frozen-lockfile`, and runs:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

The root `pnpm build` script intentionally builds publishable packages only. The root lint and typecheck scripts include workspace applications, so the docs app is covered by those checks even though its production build is owned by `pnpm build:cf`.

## Release Dry Run

Run the manual dry-run path without publishing, committing, or tagging:

```bash
gh act workflow_dispatch -W .github/workflows/release.yml -e release/act-dry-run-event.json --pull=false
```

The manual dry-run path previews the calculated version, changelog entry, and packages that would be published. The full-release path and merged package-scoped PR path can update package versions and publish to the npm registry; only the full-release path updates changelogs and tags.

## Pull Request Title Check

Test the PR title workflow with a synthetic event:

```bash
printf '{"pull_request":{"title":"fix(repo): validate workflow","number":1}}\n' > /tmp/pr-event.json
gh act pull_request -e /tmp/pr-event.json -W .github/workflows/pr-title-check.yml --pull=false
```

## Troubleshooting

Check Docker before running a workflow:

```bash
docker version
```

If dependencies need to be repaired, use `pnpm install --frozen-lockfile` from the repository root. Do not use npm lockfile or Nx commands; they are not part of the active workspace contract.

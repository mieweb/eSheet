# GitHub Workflows

The workflow YAML files in this directory are the source of truth. This page is a maintainer-oriented map of what each workflow does, when it runs, what inputs or secrets it depends on, and where to find deeper release or deployment documentation.

| Workflow file                              | Purpose                                                                        | Trigger                                                                       | Notes                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [ci.yml](./ci.yml)                         | Validate formatting, linting, tests, builds, and type checks for code changes. | Push to `main`; every pull request.                                           | Authoritative GitHub-side code validation workflow.                    |
| [pr-title-check.yml](./pr-title-check.yml) | Enforce semantic pull request titles.                                          | Pull request metadata changes: `opened`, `edited`, `synchronize`, `reopened`. | Validates PR metadata only, not code quality.                          |
| [release.yml](./release.yml)               | Run a manual release with an optional dry run.                                 | Manual `workflow_dispatch`.                                                   | Re-runs CI-equivalent checks before `npx nx release`.                  |
| [deploy-static.yml](./deploy-static.yml)   | Build and deploy the docs site and demo to production.                         | Push to `main`; manual `workflow_dispatch`.                                   | Uses SSH-based remote deployment and existing deploy runbooks/scripts. |

## CI

Source: [ci.yml](./ci.yml)

This workflow runs on every pull request and on pushes to `main`. It is the authoritative GitHub Actions validation path for repository changes and should stay aligned with the local Nx validation flow described in [README.md](../../README.md#development).

It uses full git history checkout (`fetch-depth: 0`), Node 22, and `npm ci`, then runs these commands:

```bash
npx nx format:check --base="remotes/origin/main"
npx nx run-many -t lint test build typecheck
```

Other workflows build on this baseline: [release.yml](./release.yml) re-runs the same validation gates before publishing, and [deploy-static.yml](./deploy-static.yml) runs a narrower preflight build for deployable apps only.

## Validate PR Title

Source: [pr-title-check.yml](./pr-title-check.yml)

This workflow runs when pull request metadata changes: `opened`, `edited`, `synchronize`, and `reopened`. It uses `amannn/action-semantic-pull-request` with the repository `GITHUB_TOKEN` to enforce conventional PR titles.

Scope is required. Allowed types are `feat`, `enhance`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, and `repo`. Allowed scopes are `repo`, `docs`, `demo`, `core`, `fields`, `builder`, `renderer`, `renderer-standalone`, and `renderer-blaze`.

This workflow validates PR metadata, not the code itself. Its purpose is to keep history consistent and make release semantics easier to reason about alongside conventional commits.

## Release

Source: [release.yml](./release.yml)

This workflow is manual only and runs through `workflow_dispatch`. It has one input:

- `dry-run` (boolean, default `true`): when enabled, runs `npx nx release --dry-run --yes`; otherwise runs `npx nx release --yes`.

Before release, it performs the same preflight gates as [ci.yml](./ci.yml): full checkout, Node 22 setup, `npm ci`, `npx nx format:check --base="remotes/origin/main"`, and `npx nx run-many -t lint test build typecheck`.

The workflow requires `contents: write` permission because it performs repository-writing release operations. For the broader release model and local release commands, see [README.md](../../README.md#releasing).

## Deploy Static Site

Source: [deploy-static.yml](./deploy-static.yml)

This workflow deploys the production static outputs for the docs site and demo. It runs automatically on pushes to `main`, and it can also be started manually with `workflow_dispatch`.

Manual inputs:

- `ref`: branch, tag, or SHA to deploy. Defaults to `main`.
- `confirm`: must be exactly `deploy` before a manual production deploy will proceed.

Safety checks and preflight steps:

- Manual runs fail unless `confirm` is exactly `deploy`.
- The selected ref must be on `origin/main` history.
- The workflow installs dependencies with `npm ci`.
- It builds only the deployable apps with `npx nx run-many -t build -p docs,demo --outputStyle=static`.

Remote deployment shape:

- Check out the requested ref with full git history.
- Configure SSH access.
- SSH to the deployment host.
- In the remote repo, fetch, check out the requested ref, run `npm ci`, and execute [deploy/scripts/deploy-static.sh](../../deploy/scripts/deploy-static.sh).

Required secrets:

- `DEPLOY_SSH_KEY`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_REPO_PATH`

Optional secret:

- `DEPLOY_KNOWN_HOSTS` if you want to pin host keys explicitly instead of relying on `ssh-keyscan` during the workflow.

For operational details, server setup, rollback steps, and the deployed Nginx configuration, see [deploy/RUNBOOK-nginx-atomic.md](../../deploy/RUNBOOK-nginx-atomic.md), [deploy/scripts/deploy-static.sh](../../deploy/scripts/deploy-static.sh), and [deploy/nginx/default.conf](../../deploy/nginx/default.conf).

## Maintenance

When a workflow trigger, input, secret requirement, permission level, or task list changes, update this README in the same pull request. Prefer linking to existing runbooks or root documentation instead of duplicating command-heavy operational detail here.

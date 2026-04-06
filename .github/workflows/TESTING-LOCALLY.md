# Local Workflow Testing with gh act

This guide explains how to test all GitHub Actions workflows locally using `gh act`, including the atomic deploy workflow against a Docker SSH target.

## Prerequisites

- `gh` CLI installed and authenticated
- Act installed (`gh act` is built-in with newer gh versions; see [act documentation](https://github.com/nektos/act) if needed)
- Docker and Docker Compose available
- Node 22+ and npm/pnpm installed

## Quick Reference

| Workflow                              | Command                                                                                          | Notes                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **CI** (lint, test, build, typecheck) | `gh act push -W .github/workflows/ci.yml --pull=false`                                           | No secrets needed; validates code quality                                                |
| **Release** (with dry-run)            | `gh act push -W .github/workflows/release.yml --pull=false`                                      | Tests release workflow without publishing; requires git history                          |
| **PR Title Check**                    | `gh act pull_request -e /tmp/pr-event.json -W .github/workflows/pr-title-check.yml --pull=false` | Uses synthetic PR event; see [Testing PR Title Check](#testing-pr-title-check)           |
| **Atomic Deploy**                     | `gh act push -W .github/workflows/atomic-deploy.yml --secret-file .secrets.local ...`            | Requires Docker container + SSH setup; see [Local Deploy Testing](#local-deploy-testing) |

**Note on `--pull=false`:** This flag skips pulling the Docker runner image and uses a cached local copy. Use it on subsequent runs to avoid Docker Hub rate-limiting and auth issues. On the **first run (ever)**, omit `--pull=false` to pull and cache the runner image (~1 min), then use it for all subsequent runs.

---

## General Setup (All Workflows)

### 1. Verify git checkout

All workflows expect a full git history or a properly resolved base ref:

```bash
# Check current branch
git status

# Ensure you have origin/main available locally
git fetch origin main --depth=1
```

### 2. Test a workflow locally

From repository root:

```bash
# First time using gh act (pulls the runner image, ~1 min):
gh act push -W .github/workflows/ci.yml

# Subsequent runs (uses cached image, much faster):
gh act push -W .github/workflows/ci.yml --pull=false
```

The workflow runs through all jobs; watch Terminal output for step details. After the first run, always use `--pull=false` to skip the image pull and avoid Docker Hub rate-limiting.

---

## Testing Individual Workflows

### Testing CI Workflow

The CI workflow validates formatting, linting, tests, builds, and type checking.

**Command:**

```bash
gh act push -W .github/workflows/ci.yml --pull=false
```

**What it does:**

1. Checks out current branch with full git history
2. Sets up Node 22 and npm
3. Runs `npm ci`
4. Validates `npx nx format:check --base="remotes/origin/main"` (no uncommitted changes allowed)
5. Runs all lint, test, build, typecheck targets via `npx nx run-many -t lint test build typecheck`

**Expected result:**

All steps show ✅; final line is `Job succeeded`. If any step fails, review the output to identify which target(s) need fixing.

**Troubleshooting:**

- If `format:check` fails locally but passes in CI, run `npx nx format` to auto-fix formatting
- If you see "cannot find module" errors, run `npm ci` to ensure lockfile-locked dependencies
- If you see stale module errors after checkpoint or machine restart, run `npm ci` to reset node_modules

### Testing Release Workflow

The Release workflow re-runs CI checks, then performs a dry-run release (no publishing).

**Command:**

```bash
gh act push -W .github/workflows/release.yml --pull=false
```

**What it does:**

1. Runs all CI checks (format, lint, test, build, typecheck) — same as [CI Workflow](#testing-ci-workflow)
2. Executes `npx nx release --dry-run --yes`
3. Shows what would be released without actually publishing

**Expected result:**

All preflight checks pass ✅. Release step shows dry-run output (version bumps, changelog entries, git tags simulated). Final line is `Job succeeded`.

**Note:** This does not publish to npm; it's purely a validation and preview.

### Testing PR Title Check

The PR Title Check workflow validates that pull request titles follow the conventional commits format.

**Format requirement:**

```
<type>(<scope>): <description>
```

- **Type:** `feat`, `enhance`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `repo`
- **Scope:** `repo`, `docs`, `demo`, `core`, `fields`, `builder`, `renderer`, `renderer-standalone`, `renderer-blaze`
- **Description:** Any non-empty string without special characters

**Example valid titles:**

- `feat(builder): add inline field validation`
- `fix(core): resolve circular dependency in schema`
- `docs(repo): update deployment runbook`
- `chore(renderer): upgrade React`

**How to test (using synthetic event payloads):**

Since `gh act` runs locally without access to real GitHub PRs, you must create a synthetic event JSON file that mimics a GitHub PR event. The `-e` flag tells `gh act` which event file to use.

**Command with a valid PR title:**

```bash
printf '{"pull_request":{"title":"fix(repo): validate local pr title check","number":123}}\n' > /tmp/pr-event.json
gh act pull_request -e /tmp/pr-event.json -W .github/workflows/pr-title-check.yml --pull=false
```

What this does:

- `printf ... > /tmp/pr-event.json` creates a temporary JSON file that simulates a real GitHub PR event
- `-e /tmp/pr-event.json` tells `gh act` to use this synthetic event instead of a real PR
- The workflow reads `${{ github.event.pull_request.title }}` from the JSON and validates it against the conventional commits format

**Command with an invalid PR title (for testing rejection):**

```bash
printf '{"pull_request":{"title":"this is not a valid pr title","number":123}}\n' > /tmp/pr-event.json
gh act pull_request -e /tmp/pr-event.json -W .github/workflows/pr-title-check.yml --pull=false
```

**Expected result (valid title):**

- Step "Validate PR title format" shows ✅
- Output includes `PR title is valid: fix(repo): ...`
- Final line is `Job succeeded`

**Expected result (invalid title):**

- Step "Validate PR title format" shows ❌
- Output includes error message with the invalid title
- Job fails (as expected for testing)

---

## Local Deploy Testing

The atomic deploy workflow deploys built docs and demo artifacts to a production Nginx server via SSH. Local testing requires a Docker container that mimics the production deployment target.

### One-time Setup

#### Step 1: Create SSH keys and secrets

Run the setup script to generate deploy SSH keys and `.secrets.local`:

```bash
bash deploy/scripts/manual/setup-local-deploy-test.sh
```

**What it creates:**

- `.keys-local/deploy_test_rsa` — private SSH key for deploy user
- `.keys-local/deploy_test_rsa.pub` — public SSH key
- `.secrets.local` — `.env` file with deploy secrets (host, username, paths)

**Output:** "Setup complete. Secrets stored in `.secrets.local`"

#### Step 2: Start the local deploy target container

```bash
docker-compose -f docker-compose.local.yml up -d
```

**What it does:**

- Builds/pulls the deploy-target image (Ubuntu 22.04 + Nginx + OpenSSH)
- Starts container named `esheet-deploy-target`
- Maps port 2046 → 22 (SSH)
- Maps port 8080 → 80 (Nginx HTTP)

**Verify container is running:**

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

Should show `esheet-deploy-target` with status `Up`.

#### Step 3: Initialize remote repo on container

```bash
docker exec -u root esheet-deploy-target sh -lc "mkdir -p /home/deploy/esheet && chown -R deploy:deploy /home/deploy/esheet"
ssh -i .keys-local/deploy_test_rsa -p 2046 deploy@localhost "rm -rf /home/deploy/esheet/.git && git clone https://github.com/mieweb/eSheet.git /home/deploy/esheet"
```

**What it does:**

1. Creates `/home/deploy/esheet` directory on container and fixes permissions
2. Clones the public GitHub repository into that directory on the container
3. This gives the container a fresh baseline to work from

**Verify SSH access:**

```bash
ssh -i .keys-local/deploy_test_rsa -p 2046 deploy@localhost "whoami && pwd && ls -la"
```

Should output:

```
deploy
/home/deploy
esheet/
```

#### Step 4: Verify Nginx is running

```bash
curl -I http://localhost:8080
```

Should return:

```
HTTP/1.1 200 OK
Server: nginx/1.18.0
...
```

### Running the Atomic Deploy Workflow Locally

**Precondition:** Complete the [One-time Setup](#one-time-setup) above, and ensure the container is running.

**Important:** The atomic-deploy workflow clones from GitHub, so the commit under test must already exist on the remote repository. Unpushed local changes will not work.

**Default test:**

```bash
gh act push -W .github/workflows/atomic-deploy.yml --secret-file .secrets.local -s DEPLOY_SSH_KEY="$(cat .keys-local/deploy_test_rsa)" --pull=false
```

**What it does:**

1. Loads secrets from `.secrets.local` file
2. Injects the private SSH key as `DEPLOY_SSH_KEY`
3. Runs the `atomic-deploy.yml` workflow locally:
   - Checks out the current commit for the local run
   - Builds docs and demo apps
   - SSHes to `localhost:2046` (the container)
   - Fetches the commit under test on the container repo
   - Runs `npm ci` on container
   - Executes `deploy/scripts/workflow/atomic-deploy.sh` on container
   - Rsyncs build artifacts to `/home/llatt/sites/esheet/releases/<sha>/`
   - Updates `/home/llatt/sites/esheet/current` symlink and reloads Nginx

**Expected result:**

- Build steps show ✅
- SSH connectivity step shows ✅
- Remote script execution shows ✅ (with rsync and symlink output)
- Final line is `Job succeeded`
- Nginx serves from `/home/llatt/sites/esheet/current` via `deploy/nginx/local.conf`

**Verify deployment succeeded:**

```bash
# Check that current symlink points to the latest build
ssh -i .keys-local/deploy_test_rsa -p 2046 deploy@localhost "ls -la /home/llatt/sites/esheet && ls -la /home/llatt/sites/esheet/current"

# Fetch a page from the deployed docs/demo
curl -s http://localhost:8080 | head -20
```

### Troubleshooting Deploy Workflow

**SSH connection refused:**

```
err: could not read Username for 'https://github.com': terminal prompts disabled
Host key verification failed.
```

**Solution:**

1. Verify container is running: `docker ps`
2. Verify SSH key is correct: `ssh -i .keys-local/deploy_test_rsa -p 2046 deploy@localhost "whoami"`
3. Recreate SSH keys: `bash deploy/scripts/manual/refresh-local-ssh-key.sh`

**Script not found on container (`deploy-static.sh: command not found`):**

The container's repo is out of sync with your local changes. The deploy script was renamed to `deploy/scripts/workflow/atomic-deploy.sh`, but the container may have an older checkout.

**Solution:**

Pull the latest changes on the container:

```bash
ssh -i .keys-local/deploy_test_rsa -p 2046 deploy@localhost "cd /home/deploy/esheet && git fetch origin && git checkout origin/main && npm ci"
```

Or force-recreate the container:

```bash
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up -d
# Then re-run init (Step 3 above)
docker exec -u root esheet-deploy-target sh -lc "mkdir -p /home/deploy/esheet && chown -R deploy:deploy /home/deploy/esheet"
ssh -i .keys-local/deploy_test_rsa -p 2046 deploy@localhost "rm -rf /home/deploy/esheet/.git && git clone https://github.com/mieweb/eSheet.git /home/deploy/esheet"
```

**Rsync permission denied:**

```
rsync error: some files could not be transferred (code 23)
```

**Solution:**

Verify the deploy user owns the target directory:

```bash
ssh -i .keys-local/deploy_test_rsa -p 2046 deploy@localhost "ls -ld /home/deploy/esheet"
```

Should show owner as `deploy:deploy`. If not, fix it:

```bash
docker exec -u root esheet-deploy-target chown -R deploy:deploy /home/deploy/esheet
```

---

## Re-running Workflows Later

Once you've completed one-time setup, you can quickly restart the container and re-test:

```bash
# Restart container
docker-compose -f docker-compose.local.yml up -d

# Test CI (no container needed)
gh act push -W .github/workflows/ci.yml --pull=false

# Test release (no container needed)
gh act push -W .github/workflows/release.yml --pull=false

# Test deploy (uses container)
gh act push -W .github/workflows/atomic-deploy.yml --secret-file .secrets.local -s DEPLOY_SSH_KEY="$(cat .keys-local/deploy_test_rsa)" --pull=false
```

---

## Best Practices

1. **First-run vs. subsequent runs:**
   - **First time ever using `gh act`:** Run without `--pull=false` to pull the runner image (one-time, ~1 min)
   - **Subsequent runs:** Always use `--pull=false` to skip Docker Hub pulls and avoid rate-limiting
2. **Test locally before pushing** to main — run CI, release dry-run, and deploy workflows locally to catch issues early

3. **Keep `.secrets.local` in `.gitignore`** — it contains deploy credentials and should never be committed

4. **Refresh SSH keys if container is recreated:** The container's host key changes, and you may need to remove old entries from `~/.ssh/known_hosts` (see [refresh-local-ssh-key.sh](./scripts/manual/refresh-local-ssh-key.sh))

5. **Commit and push before testing deploy** — the container clones from GitHub, so unpushed local changes cannot be tested

6. **Inspect failed steps** — act shows full step output; scroll up in Terminal to find error details before re-running

---

## Cleanup

To stop the local deploy container and remove artifacts:

```bash
# Stop container
docker-compose -f docker-compose.local.yml down

# Remove container image (optional, will rebuild on next up)
docker rmi esheet-deploy-target
```

To remove all local deploy credentials and keys:

```bash
rm -rf .keys-local .secrets.local
```

These can be regenerated anytime by re-running `bash deploy/scripts/manual/setup-local-deploy-test.sh`.

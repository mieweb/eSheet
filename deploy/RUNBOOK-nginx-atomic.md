# Nginx Static Hosting and Atomic Deployment Runbook

## Purpose

This document captures production static hosting for eSheet with atomic deployments.

`<deploy-root>` is the deployment root chosen by the operator, for example `/srv/esheet` or `/var/www/esheet`.

## Current Architecture

- Build docs and demo with Nx.
- Copy build output into SHA release directories.
- Switch current symlink atomically.
- Reload Nginx.
- Keep only the last 5 releases.

## Repository Files

- Nginx config: deploy/nginx/default.conf
- Deploy script: deploy/scripts/workflow/atomic-deploy.sh
- Host setup helper: deploy/scripts/manual/setup-nginx.sh

## Nginx Config

Nginx serves from this symlink target root:

- `<deploy-root>/current`

Routing:

- / -> docs index fallback
- /demo/ -> demo index fallback
- /demo/assets/\* -> strict file serving + immutable cache headers

## One-Time Host Setup

1. Install and configure Nginx from repo.

```bash
chmod +x deploy/scripts/manual/setup-nginx.sh
./deploy/scripts/manual/setup-nginx.sh
```

2. Ensure Nginx can traverse release paths.

```bash
DEPLOY_ROOT=<deploy-root>
sudo mkdir -p "$DEPLOY_ROOT/releases"
sudo chown -R "$(id -un):$(id -gn)" "$DEPLOY_ROOT"
# If DEPLOY_ROOT is under restricted parent directories, grant execute on each parent as needed.
```

## Deployment

Run the production deploy script.

```bash
chmod +x deploy/scripts/workflow/atomic-deploy.sh
./deploy/scripts/workflow/atomic-deploy.sh
```

What this does:

1. Builds docs and demo.
2. Copies to `<deploy-root>/releases/<SHA>/` and `<deploy-root>/releases/<SHA>/demo/`.
3. Switches `<deploy-root>/current` -> new SHA release.
4. Prunes old releases, keeping latest 5.
5. Validates and reloads Nginx.

## Verification

```bash
sudo nginx -t
sudo systemctl status nginx
ls -la <deploy-root>/current
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/demo/
```

## Rollback

Point current back to a known-good SHA and reload Nginx.

```bash
sudo ln -sfn <deploy-root>/releases/<GOOD_SHA> <deploy-root>/current
sudo nginx -s reload
```

## CI/CD Note

In GitHub Actions, make sure deploy user can run non-interactive Nginx commands.

Example sudoers entry:

```bash
# /etc/sudoers.d/deploy-nginx
deployuser ALL=(root) NOPASSWD:/usr/sbin/nginx,/bin/systemctl reload nginx
```

# Nginx Static Hosting and Atomic Deployment Runbook

## Purpose

This document captures production static hosting for eSheet with atomic deployments.

## Current Architecture

- Build docs and demo with Nx.
- Copy build output into SHA release directories.
- Switch current symlink atomically.
- Reload Nginx.
- Keep only the last 5 releases.

## Repository Files

- Nginx config: deploy/nginx/default.conf
- Deploy script: deploy/scripts/deploy-static.sh
- Host setup helper: deploy/scripts/setup-nginx.sh

## Nginx Config

Nginx serves from this symlink target root:

- /home/llatt/sites/esheet/current

Routing:

- / -> docs index fallback
- /demo/ -> demo index fallback
- /demo/assets/\* -> strict file serving + immutable cache headers

## One-Time Host Setup

1. Install and configure Nginx from repo.

```bash
chmod +x deploy/scripts/setup-nginx.sh
./deploy/scripts/setup-nginx.sh
```

2. Ensure Nginx can traverse release paths.

```bash
sudo chmod o+x /home
sudo chmod o+x /home/llatt
sudo mkdir -p /home/llatt/sites/esheet/releases
sudo chown -R "$(id -un):$(id -gn)" /home/llatt/sites/esheet
```

## Deployment

Run the production deploy script.

```bash
chmod +x deploy/scripts/deploy-static.sh
./deploy/scripts/deploy-static.sh
```

What this does:

1. Builds docs and demo.
2. Copies to /home/llatt/sites/esheet/releases/<SHA>/ and /home/llatt/sites/esheet/releases/<SHA>/demo/.
3. Switches /home/llatt/sites/esheet/current -> new SHA release.
4. Prunes old releases, keeping latest 5.
5. Validates and reloads Nginx.

## Verification

```bash
sudo nginx -t
sudo systemctl status nginx
ls -la /home/llatt/sites/esheet/current
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/demo/
```

## Rollback

Point current back to a known-good SHA and reload Nginx.

```bash
sudo ln -sfn /home/llatt/sites/esheet/releases/<GOOD_SHA> /home/llatt/sites/esheet/current
sudo nginx -s reload
```

## CI/CD Note

In GitHub Actions, make sure deploy user can run non-interactive Nginx commands.

Example sudoers entry:

```bash
# /etc/sudoers.d/deploy-nginx
deployuser ALL=(root) NOPASSWD:/usr/sbin/nginx,/bin/systemctl reload nginx
```

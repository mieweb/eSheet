#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SITE_ROOT="/home/llatt/sites/esheet"
RELEASES_DIR="$SITE_ROOT/releases"

SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
REL_DIR="$RELEASES_DIR/$SHA"

cd "$REPO_ROOT"

CI=1 NX_INTERACTIVE=false npx nx build app-docs --outputStyle=static
CI=1 NX_INTERACTIVE=false npx nx build app-demo --outputStyle=static

sudo mkdir -p "$REL_DIR/demo"
sudo rsync -a --delete "$REPO_ROOT/apps/docs/build/" "$REL_DIR/"
sudo rsync -a --delete "$REPO_ROOT/apps/demo/dist/" "$REL_DIR/demo/"

sudo mkdir -p "$SITE_ROOT"
sudo ln -sfn "$REL_DIR" "$SITE_ROOT/current"

# Keep only the latest 5 release directories.
sudo bash -lc 'ls -1dt "'"$RELEASES_DIR"'"/* 2>/dev/null | tail -n +6 | xargs -r rm -rf'

sudo install -m 644 "$REPO_ROOT/deploy/nginx/default.conf" /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl reload nginx

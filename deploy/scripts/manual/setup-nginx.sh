#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

sudo apt-get update
sudo apt-get install -y nginx

sudo install -m 644 "$REPO_ROOT/deploy/nginx/default.conf" /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl reload nginx

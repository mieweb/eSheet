#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Pages build script.
# Builds both apps and merges them into a single dist/ folder:
#   dist/        ← docs site (served at /)
#   dist/demo/   ← demo app  (served at /demo/)

npx nx build app-docs --outputStyle=static
npx nx build app-demo --outputStyle=static

rm -rf dist
mkdir -p dist/demo

cp -r apps/docs/build/. dist/
cp -r apps/demo/dist/. dist/demo/

# SPA fallback rules for Cloudflare Pages (replaces nginx try_files).
cat > dist/_redirects <<'EOF'
/demo/*  /demo/index.html  200
/*       /index.html       200
EOF

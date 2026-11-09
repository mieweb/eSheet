#!/usr/bin/env bash
set -euo pipefail

# Regional DateInput APIs are not published yet. Match the sibling link in
# package.json with a reproducible source build for CI and Cloudflare Pages.
UI_REVISION=4678cb7c5cdabe30ce47edbb6d77e990d3f75f37
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UI_DIR="$(dirname "$ROOT")/ui"

if [[ ! -e "$UI_DIR" ]]; then
  git init "$UI_DIR"
  git -C "$UI_DIR" remote add origin https://github.com/mieweb/ui.git
  git -C "$UI_DIR" fetch --depth 1 origin "$UI_REVISION"
  git -C "$UI_DIR" checkout --detach FETCH_HEAD
fi

if [[ "$(git -C "$UI_DIR" rev-parse --show-toplevel)" != "$UI_DIR" ]] ||
  [[ "$(git -C "$UI_DIR" rev-parse HEAD)" != "$UI_REVISION" ]]; then
  echo "Expected $UI_DIR to be a UI checkout at $UI_REVISION; refusing to replace an existing directory." >&2
  exit 1
fi

if [[ -n "$(git -C "$UI_DIR" status --porcelain)" ]]; then
  echo "$UI_DIR has local changes; refusing to modify or build a dirty checkout." >&2
  exit 1
fi

git -C "$UI_DIR" submodule update --init --recursive
(
  cd "$UI_DIR"
  corepack pnpm install --frozen-lockfile
  corepack pnpm build
)

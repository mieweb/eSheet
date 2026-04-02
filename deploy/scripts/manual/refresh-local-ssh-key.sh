#!/usr/bin/env bash
set -euo pipefail

host="${1:-localhost}"
port="${2:-2046}"

mkdir -p "$HOME/.ssh"

target="[$host]:$port"
known_hosts="$HOME/.ssh/known_hosts"

echo "Removing old known_hosts entry for $target"
ssh-keygen -R "$target" >/dev/null 2>&1 || true

echo "Fetching current host keys from $host:$port"
ssh-keyscan -p "$port" -t ed25519,ecdsa "$host" >>"$known_hosts"

echo "Live ed25519 fingerprint:"
ssh-keyscan -p "$port" -t ed25519 "$host" 2>/dev/null | ssh-keygen -lf -

echo
echo "SSH known_hosts refreshed for $target"
echo "Try: ssh -i .keys-local/deploy_test_rsa -p $port deploy@$host"
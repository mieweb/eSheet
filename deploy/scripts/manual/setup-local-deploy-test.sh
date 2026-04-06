#!/bin/bash
# setup-local-deploy-test.sh
# One-time setup for local Docker deploy target testing

set -e

echo "=== eSheet Local Deploy Test Setup ==="
echo ""

# Locations
DEPLOY_DIR="$( cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd )"
TEST_KEY_DIR="${DEPLOY_DIR}/.keys-local"
TEST_KEY="${TEST_KEY_DIR}/deploy_test_rsa"
AUTH_KEYS="${DEPLOY_DIR}/deploy/authorized_keys.local"

# Create keys directory
mkdir -p "$TEST_KEY_DIR"

# Generate SSH key if it doesn't exist
if [ ! -f "$TEST_KEY" ]; then
    echo "Generating SSH key for local testing..."
    ssh-keygen -t rsa -b 4096 -f "$TEST_KEY" -N "" -C "esheet-deploy-test"
    echo "✓ SSH key generated at $TEST_KEY"
else
    echo "✓ SSH key already exists at $TEST_KEY"
fi

# Copy public key to authorized_keys for Docker build
echo "Syncing authorized_keys for Docker container..."
cp "${TEST_KEY}.pub" "$AUTH_KEYS"
echo "✓ authorized_keys synced"

# Store secrets for act
SECRETS_FILE="${DEPLOY_DIR}/.secrets.local"
echo "Generating .secrets.local for gh act..."

# Escape newlines in SSH key for single-line format
KEY_ESCAPED=$(awk '{printf "%s\\n", $0}' "$TEST_KEY")

cat > "$SECRETS_FILE" << SECRETS_EOF
# Local deployment test secrets for gh act
# DO NOT COMMIT THIS FILE - add to .gitignore if not already there
DEPLOY_SSH_KEY=$KEY_ESCAPED
DEPLOY_HOST=host.docker.internal
DEPLOY_USER=deploy
DEPLOY_REPO_PATH=/home/deploy/esheet
ESHEET_SITE_ORIGIN=http://localhost:8080
SECRETS_EOF

chmod 600 "$SECRETS_FILE"
echo "✓ .secrets.local generated with full SSH key"

echo ""
echo "=== Next steps ==="
echo "See deploy/DOCKER-LOCAL-DEPLOY.md for full Docker + gh act testing steps."
echo ""
echo "SSH key: $TEST_KEY"
echo "Public key: ${TEST_KEY}.pub"
echo "Secrets file: $SECRETS_FILE"

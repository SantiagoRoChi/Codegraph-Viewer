#!/bin/bash
# Script to publish the extension to VS Code Marketplace
# Requires: VSCE_PAT environment variable set with Azure DevOps token
#
# Usage:
#   VSCE_PAT=<token> ./scripts/publish.sh [version]
#
# If version is omitted, it auto-increments the patch version.

set -euo pipefail

VERSION="${1:-patch}"

echo "==> Compiling extension..."
npm run compile

echo "==> Publishing version bump: $VERSION"
npx vsce publish "$VERSION"

echo "==> Done! Version published."

# Script to publish the extension to VS Code Marketplace
# Requires: VSCE_PAT environment variable set with Azure DevOps token
#
# Usage:
#   $env:VSCE_PAT = "<token>"
#   .\scripts\publish.ps1 [version]

param(
    [string]$Version = "patch"
)

Write-Host "==> Compiling extension..."
npm run compile

Write-Host "==> Publishing version bump: $Version"
npx vsce publish $Version

Write-Host "==> Done! Version published."

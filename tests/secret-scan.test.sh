#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$root/deploy/customer/scan-secrets.sh" --path "$root/docs" --path "$root/deploy" --path "$root/skills"
echo 'secret scan checks passed'

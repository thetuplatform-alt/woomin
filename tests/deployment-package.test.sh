#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
entry="$root/docs/deployment/AGENT.md"

test -f "$entry"
for page in install.md update.md add-service.md verification.md rollback.md troubleshooting.md; do
  grep -Fq "($page)" "$entry"
  test -f "$root/docs/deployment/$page"
done

grep -Fq 'browser authorization' "$entry"
grep -Fq 'billing' "$entry"
grep -Fq 'third-party credentials' "$entry"
grep -Fq 'account choice' "$entry"

echo 'deployment package entrypoint checks passed'

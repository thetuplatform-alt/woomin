#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
skill="$root/skills/woomin-platform-ops/SKILL.md"
for operation in install update upgrade troubleshoot; do grep -Fq "\`$operation\`" "$skill"; done
grep -Fq 'customer `origin`' "$skill"
grep -Fq 'vendor `upstream`' "$skill"
grep -Fq 'dirty worktree' "$skill"
grep -Fq 'state secret' "$skill"
echo 'platform operations skill checks passed'

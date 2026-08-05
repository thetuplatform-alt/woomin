#!/usr/bin/env bash
set -euo pipefail
origin="$(git remote get-url origin 2>/dev/null || true)"
upstream="$(git remote get-url upstream 2>/dev/null || true)"
branch="$(git branch --show-current)"
commit="$(git rev-parse HEAD)"
printf 'stage=upgrade-report origin=%s upstream=%s branch=%s production_commit=%s\n' "${origin:-unset}" "${upstream:-unset}" "$branch" "$commit"
if [[ -n "$(git status --porcelain)" ]]; then echo 'conflict_report=dirty-worktree; action=stop-and-commit-or-stash'; exit 1; fi
if [[ -z "$upstream" ]]; then echo 'migration_report=upstream-not-configured; action=stop-before-merge'; exit 1; fi
echo 'migration_report=manual-review-required; action=run-dry-run-before-merge'

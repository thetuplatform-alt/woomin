#!/usr/bin/env bash
set -euo pipefail
missing=()
for tool in git docker; do command -v "$tool" >/dev/null 2>&1 || missing+=("tool:$tool"); done
if ! command -v npx >/dev/null 2>&1 && ! command -v zeabur >/dev/null 2>&1; then missing+=("tool:zeabur-cli-or-npx"); fi
for field in ZEABUR_WORKSPACE ZEABUR_PROJECT_ID ZEABUR_SERVICE_ID ZEABUR_DOMAIN; do [[ -n "${!field:-}" ]] || missing+=("field:$field"); done
if ((${#missing[@]})); then printf 'bootstrap preflight failed; missing safe fields: %s\n' "${missing[*]}" >&2; exit 1; fi
printf 'workspace=%s project=%s service=%s domain=%s stage=preflight\n' "$ZEABUR_WORKSPACE" "$ZEABUR_PROJECT_ID" "$ZEABUR_SERVICE_ID" "$ZEABUR_DOMAIN"
printf '%s\n' 'No paid resource mutation was performed.'

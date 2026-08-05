#!/usr/bin/env bash
set -euo pipefail
missing=()
for tool in git curl; do command -v "$tool" >/dev/null 2>&1 || missing+=("tool:$tool"); done
for field in ZEABUR_ACCOUNT ZEABUR_SERVER_ID ZEABUR_PROJECT_ID ZEABUR_SERVICE_ID ZEABUR_DOMAIN ZEABUR_REGION; do [[ -n "${!field:-}" ]] || missing+=("field:$field"); done
[[ "${HAS_K3S:-}" == true ]] || missing+=("state:HasK3s=true")
if ((${#missing[@]})); then printf 'preflight failed; no mutation performed; missing: %s\n' "${missing[*]}" >&2; exit 1; fi
printf 'account=%s server=%s region=%s project=%s service=%s domain=%s stage=preflight next_action=run deployment\n' "$ZEABUR_ACCOUNT" "$ZEABUR_SERVER_ID" "$ZEABUR_REGION" "$ZEABUR_PROJECT_ID" "$ZEABUR_SERVICE_ID" "$ZEABUR_DOMAIN"

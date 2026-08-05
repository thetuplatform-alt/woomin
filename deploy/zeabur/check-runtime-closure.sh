#!/usr/bin/env bash
set -euo pipefail
dockerfile="${1:-Dockerfile}"
[[ -f "$dockerfile" ]] || { echo "runtime-closure stage=input missing=$dockerfile" >&2; exit 1; }
required=("@prisma/adapter-pg" "zod" "dotenv" "pg" "scripts/prisma-migrate-deploy.cjs")
missing=()
for item in "${required[@]}"; do grep -Fq "$item" "$dockerfile" || missing+=("$item"); done
if ((${#missing[@]})); then printf 'runtime-closure stage=promotion blocked_missing=%s\n' "${missing[*]}" >&2; exit 1; fi
printf '%s\n' 'runtime-closure stage=promotion passed'

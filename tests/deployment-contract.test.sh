#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
grep -Fq 'PORT=8080' "$root/deploy/zeabur/service-spec.env.example"
grep -Fq 'LOCAL_STORAGE_ROOT=/data/uploads' "$root/deploy/zeabur/service-spec.env.example"
grep -Fq 'VOLUME_MOUNT=/data' "$root/deploy/zeabur/service-spec.env.example"
"$root/deploy/zeabur/check-runtime-closure.sh" "$root/Dockerfile"
echo 'deployment contract checks passed'

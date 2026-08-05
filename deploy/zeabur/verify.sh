#!/usr/bin/env bash
set -euo pipefail
domain="${ZEABUR_DOMAIN:-}"; expected="${GIT_COMMIT_SHA:-}"
while (($#)); do case "$1" in --domain) domain="$2"; shift 2;; --expected-sha) expected="$2"; shift 2;; *) echo "unknown option: $1" >&2; exit 2;; esac; done
"$(cd "$(dirname "${BASH_SOURCE[0]}")/../customer" && pwd)/verify-deployment.sh" --domain "$domain" --expected-sha "$expected"
printf '%s\n' 'gate=manual: migration,pod-readiness,volume-restart-marker,cron-route-matrix must be recorded from Zeabur/server checks'

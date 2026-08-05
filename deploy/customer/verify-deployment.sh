#!/usr/bin/env bash
set -euo pipefail
domain=""; expected=""
while (($#)); do case "$1" in --domain) domain="$2"; shift 2;; --expected-sha) expected="$2"; shift 2;; *) echo "unknown option: $1" >&2; exit 2;; esac; done
[[ "$domain" == https://* ]] || { echo 'verify stage=http: --domain must be HTTPS' >&2; exit 1; }
[[ -n "$expected" && "$expected" != *[[:space:]]* ]] || { echo 'verify stage=version: expected SHA is required' >&2; exit 1; }
base="${domain%/}"
max_attempts=40
sleep_seconds=15
for attempt in $(seq 1 "$max_attempts"); do
  http_ok=1
  for path in / /api/version; do code="$(curl -fsS -o /tmp/woomin-verify-body -w '%{http_code}' --max-time 20 "$base$path" || true)"; [[ "$code" == 2* ]] || { http_ok=0; break; }; done
  if [[ "$http_ok" == "1" ]]; then
    version="$(curl -fsS --max-time 20 "$base/api/version" || true)"
    if printf '%s' "$version" | grep -Fq "$expected"; then
      printf 'stage=complete domain=%s expected_sha=%s version_check=passed attempts=%s\n' "$domain" "$expected" "$attempt"
      exit 0
    fi
  fi
  echo "verify stage=waiting attempt=$attempt/$max_attempts expected_sha=$expected" >&2
  sleep "$sleep_seconds"
done
echo "verify stage=version sha_mismatch expected_sha=$expected timeout_after=$((max_attempts * sleep_seconds))s" >&2
exit 1

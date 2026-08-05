#!/usr/bin/env bash
set -euo pipefail
expected="${GIT_COMMIT_SHA:-}"; domain="${ZEABUR_DOMAIN:-}"
[[ -n "$expected" && -n "$domain" ]] || { echo 'health-gates stage=config missing expected SHA or domain' >&2; exit 1; }
"$(cd "$(dirname "${BASH_SOURCE[0]}")/../customer" && pwd)/verify-deployment.sh" --domain "$domain" --expected-sha "$expected"
for gate in migration pod-readiness in-container-8080 external-https version-sha data-mount restart-marker cron-routes; do
  var="GATE_${gate//-/_}"
  [[ "${!var:-}" == passed ]] || { echo "health-gates stage=$gate status=not-recorded" >&2; exit 1; }
done
echo 'health-gates stage=complete all_core_gates=passed optional_providers=non-blocking'

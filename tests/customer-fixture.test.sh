#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
echo '#!/bin/sh' > "$tmp/bin/docker"
echo '#!/bin/sh' > "$tmp/bin/npx"
chmod +x "$tmp/bin/docker" "$tmp/bin/npx"
PATH="$tmp/bin:/usr/bin:/bin" ZEABUR_WORKSPACE=fixture ZEABUR_PROJECT_ID=project ZEABUR_SERVICE_ID=service ZEABUR_DOMAIN=https://example.com "$root/deploy/customer/bootstrap.sh" >/dev/null
if ZEABUR_DOMAIN=https://example.com "$root/deploy/customer/verify-deployment.sh" --domain http://invalid --expected-sha deadbeef >/dev/null 2>&1; then exit 1; fi
ruby -e 'require "yaml"; YAML.load_file(ARGV.fetch(0));' "$root/.github/workflows/deploy-zeabur.yml"
"$root/deploy/zeabur/check-runtime-closure.sh" "$root/Dockerfile" >/dev/null
echo 'customer fixture checks passed'

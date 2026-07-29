#!/bin/sh
set -eu

: "${APP_URL:?請設定 APP_URL，例如 https://example.com}"
: "${CRON_SECRET:?請設定 CRON_SECRET}"

APP_URL="${APP_URL%/}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-60}"
COURSE_EXPIRATION_INTERVAL_SECONDS="${COURSE_EXPIRATION_INTERVAL_SECONDS:-86400}"
SUBSCRIPTION_MAINTENANCE_INTERVAL_SECONDS="${SUBSCRIPTION_MAINTENANCE_INTERVAL_SECONDS:-86400}"

call_route() {
  route="$1"
  printf '[woomin-cron] %s\n' "$route"
  curl --fail --silent --show-error --max-time 55 \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "${APP_URL}/api/cron/${route}" >/dev/null || \
    printf '[woomin-cron] route failed: %s\n' "$route" >&2
}

last_course=0
last_subscription=0
last_minute=0

while :; do
  now="$(date +%s)"

  if [ "$last_course" -eq 0 ] || [ $((now - last_course)) -ge "$COURSE_EXPIRATION_INTERVAL_SECONDS" ]; then
    call_route course-expiration
    last_course="$now"
  fi

  if [ "$last_subscription" -eq 0 ] || [ $((now - last_subscription)) -ge "$SUBSCRIPTION_MAINTENANCE_INTERVAL_SECONDS" ]; then
    call_route subscription-maintenance
    last_subscription="$now"
  fi

  if [ "$last_minute" -eq 0 ] || [ $((now - last_minute)) -ge 60 ]; then
    call_route newsletter-dispatch
    call_route assignment-cleanup
    call_route cloudflare-stream-sync
    call_route newsletter-automation-dispatch
    last_minute="$now"
  fi

  sleep "$INTERVAL_SECONDS"
done

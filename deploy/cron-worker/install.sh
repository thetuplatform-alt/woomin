#!/bin/sh
set -eu

: "${APP_URL:?請先 export APP_URL，例如 https://example.com}"
: "${CRON_SECRET:?請先 export CRON_SECRET}"

install_dir="${WOOMIN_CRON_INSTALL_DIR:-${HOME}/.local/bin}"
config_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/woomin"
worker_path="${install_dir}/woomin-cron-worker.sh"
env_path="${config_dir}/cron-worker.env"

mkdir -p "$install_dir" "$config_dir"
cp "$(dirname "$0")/worker.sh" "$worker_path"
chmod 700 "$worker_path"
{
  printf 'APP_URL=%s\n' "$APP_URL"
  printf 'CRON_SECRET=%s\n' "$CRON_SECRET"
} > "$env_path"
chmod 600 "$env_path"

if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  if command -v loginctl >/dev/null 2>&1; then
    loginctl enable-linger "$(whoami)"
  fi
  unit_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
  mkdir -p "$unit_dir"
  cat > "$unit_dir/woomin-cron-worker.service" <<EOF
[Unit]
Description=WooMin cron worker
After=network-online.target

[Service]
EnvironmentFile=${env_path}
ExecStart=${worker_path}
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now woomin-cron-worker.service
  printf '已用 systemd user service 啟動 WooMin cron worker。\n'
else
  printf '已安裝 worker：%s\n' "$worker_path"
  printf '此主機沒有可用的 systemd user service；請用主機的排程器執行：\n'
  printf '  . %s && %s\n' "$env_path" "$worker_path"
fi

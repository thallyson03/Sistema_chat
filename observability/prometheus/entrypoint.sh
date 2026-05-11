#!/bin/sh
set -eu

DATA_DIR="${PROMETHEUS_STORAGE_PATH:-/prometheus}"
OUT="${PROMETHEUS_CONFIG_OUT:-${DATA_DIR}/prometheus.yml}"
BEARER_FILE="${PROMETHEUS_BEARER_FILE:-${DATA_DIR}/metrics_bearer.txt}"

HOST="${CRM_METRICS_HOST:-crm.chat.chatia.qzz.io}"
PORT="${CRM_METRICS_PORT:-443}"
TOKEN="${CRM_METRICS_BEARER_TOKEN:-}"
SKIP="${CRM_SKIP_TLS_VERIFY:-false}"

if [ "$SKIP" != "true" ] && [ "$SKIP" != "false" ]; then
  echo "CRM_SKIP_TLS_VERIFY must be true or false (got: $SKIP)" >&2
  exit 1
fi

TLS_INSECURE="false"
if [ "$SKIP" = "true" ]; then
  TLS_INSECURE="true"
fi

mkdir -p "$DATA_DIR" "$(dirname "$OUT")"

{
  echo "global:"
  echo "  scrape_interval: 15s"
  echo "  evaluation_interval: 15s"
  echo ""
  echo "scrape_configs:"
  echo "  - job_name: crm-backend"
  echo "    scheme: https"
  echo "    metrics_path: /metrics"
  echo "    tls_config:"
  echo "      insecure_skip_verify: ${TLS_INSECURE}"

  if [ -n "$TOKEN" ]; then
    printf '%s' "$TOKEN" > "$BEARER_FILE"
    chmod 600 "$BEARER_FILE" 2>/dev/null || true
    echo "    authorization:"
    echo "      type: Bearer"
    echo "      credentials_file: \"${BEARER_FILE}\""
  fi

  echo "    static_configs:"
  echo "      - targets: ['${HOST}:${PORT}']"
  echo ""
  echo "  - job_name: prometheus"
  echo "    static_configs:"
  echo "      - targets: ['127.0.0.1:9090']"
} > "$OUT"

exec /bin/prometheus \
  --config.file="$OUT" \
  --storage.tsdb.path="$DATA_DIR" \
  --web.enable-lifecycle \
  "$@"

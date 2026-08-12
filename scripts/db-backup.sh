#!/usr/bin/env bash
set -euo pipefail
PROJECT="${1:-adein-release-test}"
OUTPUT="${2:-adein-backup-$(date +%Y%m%dT%H%M%S).sql.gz}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"

: "${DB_PASSWORD:?DB_PASSWORD required}"

if [ -f "$OUTPUT" ]; then
  echo "ERROR: $OUTPUT already exists. Remove it first or use a different name." >&2
  exit 1
fi

echo "Backing up $PROJECT db..."
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" exec -T db mariadb-dump -u adein -p"$DB_PASSWORD" adein_crm_dev --routines --triggers --single-transaction | gzip > "$OUTPUT"

if [ ! -s "$OUTPUT" ]; then
  echo "ERROR: Backup file is empty." >&2
  exit 1
fi

gzip -t "$OUTPUT" || { echo "ERROR: Backup file corrupt." >&2; exit 1; }

echo "Backup OK: $OUTPUT ($(stat -c%s "$OUTPUT") bytes)"

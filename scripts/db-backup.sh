#!/usr/bin/env bash
set -euo pipefail
# ADEIN Docker DB backup helper
# Usage: DB_PASSWORD=xxx ./scripts/db-backup.sh [project_name] [output_file]

PROJECT="${1:-adein-release-test}"
OUTPUT="${2:-adein-backup-$(date +%Y%m%dT%H%M%S).sql.gz}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"

: "${DB_PASSWORD:?DB_PASSWORD required}"

echo "Backing up $PROJECT db..."
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" exec -T db mariadb-dump -u adein -p"$DB_PASSWORD" adein_crm_dev --routines --triggers --single-transaction | gzip > "$OUTPUT"

echo "Backup: $OUTPUT ($(stat -c%s "$OUTPUT") bytes)"

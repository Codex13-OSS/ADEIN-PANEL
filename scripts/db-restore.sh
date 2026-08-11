#!/usr/bin/env bash
set -euo pipefail
# ADEIN Docker DB restore helper
# Usage: DB_PASSWORD=xxx ./scripts/db-restore.sh [project_name] input_file.sql.gz

PROJECT="${1:-adein-release-test}"
INPUT="${2:?Usage: db-restore.sh <project> <file.sql.gz>}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"

: "${DB_PASSWORD:?DB_PASSWORD required}"

echo "Restoring $INPUT to $PROJECT ..."
zcat "$INPUT" | docker compose -p "$PROJECT" -f "$COMPOSE_FILE" exec -T db mariadb -u adein -p"$DB_PASSWORD" adein_crm_dev

echo "Restore complete."

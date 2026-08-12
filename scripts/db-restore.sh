#!/usr/bin/env bash
set -euo pipefail
PROJECT="${1:-adein-release-test}"
INPUT="${2:?Usage: db-restore.sh <project> <file.sql.gz>}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"

: "${DB_PASSWORD:?DB_PASSWORD required}"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: $INPUT not found." >&2
  exit 1
fi

gzip -t "$INPUT" || { echo "ERROR: $INPUT is not a valid gzip file." >&2; exit 1; }

echo "Restoring $INPUT to $PROJECT ..."
zcat "$INPUT" | docker compose -p "$PROJECT" -f "$COMPOSE_FILE" exec -T db mariadb -u adein -p"$DB_PASSWORD" adein_crm_dev

echo "Restore complete."

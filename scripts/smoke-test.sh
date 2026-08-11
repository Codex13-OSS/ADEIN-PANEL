#!/usr/bin/env bash
set -euo pipefail
# Docker smoke test — read-only, no mutations

BASE="${1:-http://127.0.0.1:18080}"
PASS=0
FAIL=0

check() { local desc="$1"; local url="$2"; local status; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null); if [ "$status" = "200" ] || [ "$status" = "302" ] || [ "$status" = "301" ]; then echo "PASS $desc ($status)"; PASS=$((PASS+1)); else echo "FAIL $desc (got $status)"; FAIL=$((FAIL+1)); fi; }

echo "ADEIN Smoke Test — $BASE"
echo ""

check "Health"              "$BASE/health"
check "SPA"                 "$BASE/"
check "SPA /ventas"         "$BASE/"
check "Leads API"           "$BASE/api/local/lead-agent/leads"
check "Appointments API"    "$BASE/api/local/lead-agent/appointments"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1

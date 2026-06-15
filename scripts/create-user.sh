#!/usr/bin/env sh
# Create first user when ALLOW_REGISTRATION=false
# Usage: ./scripts/create-user.sh alice secret123
set -e
API="${MINIBILL_API:-http://localhost:8080/api}"
USER="${1:?username required}"
PASS="${2:?password required}"
curl -sf -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" && echo "User created: $USER"

#!/usr/bin/env bash
set -euo pipefail

base="${GATEWAY_URL:-http://localhost:3000}"
json() { jq -r "$1"; }

echo "UPSTREAM_MODE=${UPSTREAM_MODE:-mock}"

echo "==> /health"; curl -fsS "$base/health" | jq .
echo "==> /ready";  curl -fsS "$base/ready"  | jq .

echo "==> create agent"
AID=$(curl -fsS -XPOST "$base/api/create-agent" -H 'content-type: application/json' \
  -d '{"name":"smoke_scraper","created_by":"smoke","role":"scraper"}' | jq -r .agent_id)

echo "==> generate token"
EXP=$(date -u -d '+10 min' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || gdate -u -d '+10 min' +"%Y-%m-%dT%H:%M:%SZ")
TOK=$(curl -fsS -XPOST "$base/api/generate-token" -H 'content-type: application/json' -H 'X-Agent-Intent: lead_discovery' \
  -d "{\"agent_id\":\"$AID\",\"tools\":[\"serpapi\"],\"permissions\":[\"read\"],\"expires_at\":\"$EXP\"}" | jq -r .token)

echo "==> happy path"
curl -fsS -XPOST "$base/api/proxy" -H 'content-type: application/json' \
  -d "{\"agent_token\":\"$TOK\",\"tool\":\"serpapi\",\"action\":\"search\",\"params\":{\"q\":\"test\",\"engine\":\"google\"}}" | jq . >/dev/null

echo "==> denial path (expect 403)"
code=$(curl -s -o /dev/null -w "%{http_code}" -XPOST "$base/api/proxy" \
  -H 'content-type: application/json' \
  -d "{\"agent_token\":\"$TOK\",\"tool\":\"gmail_send\",\"action\":\"send\",\"params\":{\"to\":\"x@y.com\",\"subject\":\"no\",\"text\":\"no\"}}")
test "$code" -eq 403 || { echo "expected 403, got $code"; exit 1; }

echo "==> metrics snapshot (first 40 lines)"
curl -fsS "$base/metrics" | sed -n '1,40p'

echo "SMOKE OK"

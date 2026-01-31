#!/bin/bash
# Test script for aX dispatch handling
# Tests: deduplication, concurrent dispatches, normal flow

GATEWAY_URL="${GATEWAY_URL:-http://localhost:18789}"
AGENT_ID="${AGENT_ID:-test-agent-id}"
SECRET="${SECRET:-test-secret}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "aX Dispatch Test Suite"
echo "================================"
echo "Gateway: $GATEWAY_URL"
echo "Agent ID: $AGENT_ID"
echo ""

# Function to create signed request
send_dispatch() {
  local dispatch_id="$1"
  local message="$2"
  local label="$3"

  local timestamp=$(date +%s)
  local payload="{\"dispatch_id\":\"$dispatch_id\",\"agent_id\":\"$AGENT_ID\",\"user_message\":\"$message\",\"sender_handle\":\"test-sender\"}"

  # Create HMAC signature (requires openssl)
  local signature=$(echo -n "${timestamp}${payload}" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

  echo -e "${YELLOW}[$label]${NC} Sending dispatch $dispatch_id..."

  local response=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY_URL/ax/dispatch" \
    -H "Content-Type: application/json" \
    -H "X-AX-Signature: sha256=$signature" \
    -H "X-AX-Timestamp: $timestamp" \
    -d "$payload")

  local http_code=$(echo "$response" | tail -1)
  local body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}[$label]${NC} HTTP 200 - Response: ${body:0:100}..."
  else
    echo -e "${RED}[$label]${NC} HTTP $http_code - Response: $body"
  fi

  echo ""
}

# Test 1: Normal dispatch
echo "================================"
echo "Test 1: Normal Dispatch"
echo "================================"
send_dispatch "test-$(date +%s)-1" "Hello, this is a test message" "Normal"

sleep 2

# Test 2: Duplicate dispatch (same dispatch_id)
echo "================================"
echo "Test 2: Duplicate Detection"
echo "================================"
DEDUP_ID="dedup-test-$(date +%s)"
send_dispatch "$DEDUP_ID" "First message" "First"
sleep 1
send_dispatch "$DEDUP_ID" "Same dispatch ID - should be rejected" "Duplicate"

sleep 2

# Test 3: Concurrent dispatches (different dispatch_ids)
echo "================================"
echo "Test 3: Concurrent Dispatches"
echo "================================"
echo "Sending 3 dispatches concurrently..."
CONCURRENT_BASE="concurrent-$(date +%s)"

# Send 3 dispatches in parallel
send_dispatch "${CONCURRENT_BASE}-a" "Concurrent message A" "A" &
PID1=$!
send_dispatch "${CONCURRENT_BASE}-b" "Concurrent message B" "B" &
PID2=$!
send_dispatch "${CONCURRENT_BASE}-c" "Concurrent message C" "C" &
PID3=$!

# Wait for all to complete
wait $PID1 $PID2 $PID3

echo "================================"
echo "Test 4: Rapid Fire (same agent)"
echo "================================"
RAPID_BASE="rapid-$(date +%s)"
for i in {1..5}; do
  send_dispatch "${RAPID_BASE}-$i" "Rapid message $i" "Rapid-$i" &
done
wait

echo "================================"
echo "Tests Complete"
echo "================================"
echo "Check gateway logs for details:"
echo "  tail -50 ~/.clawdbot/logs/gateway.log | grep ax-platform"

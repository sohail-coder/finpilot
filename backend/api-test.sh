#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# FinPilot E2E Flow Test (curl)
# Usage: bash api-test.sh
# Prereqs: Server running on localhost:3000, DB seeded
# ─────────────────────────────────────────────────
set -euo pipefail

BASE="http://localhost:3000/api"
EMAIL="testuser_$(date +%s)@example.com"
PASSWORD="testpass123"

echo "=== 1. Register ==="
REGISTER=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Test User\",\"baseCurrency\":\"USD\"}")
echo "$REGISTER" | head -c 200
echo

TOKEN=$(echo "$REGISTER" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "FAIL: Could not extract token"
  exit 1
fi
echo "Token: ${TOKEN:0:20}..."

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== 2. Create Categories ==="
FOOD=$(curl -s -X POST "$BASE/categories" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Food","categoryType":"EXPENSE","color":"#EF4444"}')
FOOD_ID=$(echo "$FOOD" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created expense category: $FOOD_ID"

SALARY=$(curl -s -X POST "$BASE/categories" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Salary","categoryType":"INCOME","color":"#10B981"}')
SALARY_ID=$(echo "$SALARY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created income category: $SALARY_ID"

echo ""
echo "=== 3. List Categories ==="
curl -s "$BASE/categories" -H "$AUTH" | python3 -m json.tool 2>/dev/null || \
  curl -s "$BASE/categories" -H "$AUTH"
echo

echo ""
echo "=== 4. Create Transactions ==="
TXN1=$(curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"categoryId\":\"$FOOD_ID\",\"amount\":42.50,\"currency\":\"USD\",\"description\":\"Lunch\",\"transactionDate\":\"2026-03-15\"}")
TXN1_ID=$(echo "$TXN1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created expense: $TXN1_ID"
echo "$TXN1" | head -c 300
echo

TXN2=$(curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"categoryId\":\"$SALARY_ID\",\"amount\":5000,\"currency\":\"USD\",\"description\":\"March salary\",\"transactionDate\":\"2026-03-01\",\"isRecurring\":true}")
TXN2_ID=$(echo "$TXN2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created income: $TXN2_ID"

echo ""
echo "=== 5. List Transactions ==="
curl -s "$BASE/transactions?page=1&limit=5" -H "$AUTH" | python3 -m json.tool 2>/dev/null || \
  curl -s "$BASE/transactions?page=1&limit=5" -H "$AUTH"
echo

echo ""
echo "=== 6. Update Transaction ==="
curl -s -X PATCH "$BASE/transactions/$TXN1_ID" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"amount":55.00,"description":"Lunch + drinks"}' | head -c 300
echo

echo ""
echo "=== 7. Update Category ==="
curl -s -X PATCH "$BASE/categories/$FOOD_ID" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Food & Drinks","color":"#F97316"}' | head -c 200
echo

echo ""
echo "=== 8. Delete Transaction ==="
curl -s -X DELETE "$BASE/transactions/$TXN1_ID" -H "$AUTH"
echo

echo ""
echo "=== 9. Delete Category (should fail — has transaction) ==="
curl -s -X DELETE "$BASE/categories/$SALARY_ID" -H "$AUTH"
echo

echo ""
echo "=== 10. Delete Transaction then Category ==="
curl -s -X DELETE "$BASE/transactions/$TXN2_ID" -H "$AUTH"
echo " (deleted txn)"
curl -s -X DELETE "$BASE/categories/$SALARY_ID" -H "$AUTH"
echo " (deleted category)"

echo ""
echo "=== 11. Validation Error Tests ==="
echo "Missing required fields:"
curl -s -X POST "$BASE/transactions" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"amount":10}' | head -c 300
echo

echo "Invalid category type:"
curl -s -X POST "$BASE/categories" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Bad","categoryType":"DEBIT"}' | head -c 300
echo

echo ""
echo "=== DONE ==="

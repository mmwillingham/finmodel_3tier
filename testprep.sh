#TESTING_PLAN_WITH_CURL
export API_BASE="https://api.ordaxium.com"
export EMAIL="bolauder88@gmail.com"
export PASSWORD="abc123456"

TOKEN=$(curl -s -X POST "${API_BASE}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${EMAIL}&password=${PASSWORD}" \
  | jq -r '.access_token')

# Verify token
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "ERROR: Failed to get token"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."

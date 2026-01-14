# API Testing with cURL Commands

This guide provides cURL commands for testing all aspects of the Financial Projector API.

## Prerequisites

1. **Base URL**: Set your API base URL (adjust as needed)
   ```bash
   export API_BASE="http://localhost:8000"  # Local development
   # or
   export API_BASE="https://your-api-domain.com"  # Production
   ```

2. **Authentication**: Most endpoints require authentication. You'll need to get a token first.

---

## 1. Authentication

### 1.1 Login (Get Access Token)
```bash
curl -X POST "${API_BASE}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=your-email@example.com&password=your-password" \
  | jq '.'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 1.2 Store Token for Subsequent Requests
```bash
export TOKEN="your-access-token-here"
```

### 1.3 Get Current User Info
```bash
curl -X GET "${API_BASE}/users/me" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

---

## 2. Assets

### 2.1 Create Asset
```bash
curl -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": "2026-01-01",
    "end_date": null
  }' \
  | jq '.'
```

### 2.2 List All Assets
```bash
curl -X GET "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 2.3 Get Specific Asset
```bash
curl -X GET "${API_BASE}/assets/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 2.4 Update Asset
```bash
curl -X PUT "${API_BASE}/assets/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Asset Name",
    "category": "Investment",
    "value": 150000,
    "annual_increase_percent": 6.0
  }' \
  | jq '.'
```

### 2.5 Delete Asset
```bash
curl -X DELETE "${API_BASE}/assets/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 3. Income Items

### 3.1 Create Income Item
```bash
curl -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary",
    "description": "Salary",
    "frequency": "monthly",
    "value": 8333.33,
    "annual_increase_percent": 3.0,
    "start_date": "2026-01-01",
    "end_date": "2027-08-31",
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null
  }' \
  | jq '.'
```

### 3.2 Create Dynamic Income (Linked to Asset)
```bash
curl -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Investment",
    "description": "Dividend Income",
    "frequency": "yearly",
    "value": 0,
    "annual_increase_percent": 0,
    "start_date": "2026-01-01",
    "end_date": null,
    "taxable": true,
    "linked_item_id": 1,
    "linked_item_type": "asset",
    "percentage": 4.0
  }' \
  | jq '.'
```

### 3.3 List All Income Items
```bash
curl -X GET "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 3.4 Update Income Item
```bash
curl -X PUT "${API_BASE}/cashflow/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 10000,
    "annual_increase_percent": 4.0
  }' \
  | jq '.'
```

### 3.5 Delete Income Item
```bash
curl -X DELETE "${API_BASE}/cashflow/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 4. Expense Items

### 4.1 Create Fixed Expense
```bash
curl -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Living",
    "description": "Rent",
    "frequency": "monthly",
    "value": 2000,
    "inflation_percent": 2.0,
    "start_date": "2026-01-01",
    "end_date": null,
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null
  }' \
  | jq '.'
```

### 4.2 Create Dynamic Expense (Linked to Income - 401K style)
```bash
curl -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Investment",
    "description": "401K deduction",
    "frequency": "yearly",
    "value": 0,
    "inflation_percent": 0,
    "start_date": "2026-01-01",
    "end_date": null,
    "tax_deductible": true,
    "linked_item_id": 1,
    "linked_item_type": "income",
    "percentage": 10.0,
    "contributes_to_asset_id": 2
  }' \
  | jq '.'
```

### 4.3 List All Expense Items
```bash
curl -X GET "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 4.4 Update Expense Item
```bash
curl -X PUT "${API_BASE}/cashflow/2" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "percentage": 15.0
  }' \
  | jq '.'
```

### 4.5 Delete Expense Item
```bash
curl -X DELETE "${API_BASE}/cashflow/2" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 5. Liabilities

### 5.1 Create Simple Liability
```bash
curl -X POST "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Credit Card Debt",
    "category": "Debt",
    "value": 5000,
    "annual_increase_percent": 0
  }' \
  | jq '.'
```

### 5.2 Create Amortized Loan
```bash
curl -X POST "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mortgage",
    "category": "Debt",
    "value": 300000,
    "annual_increase_percent": 0,
    "loan_type": "amortized",
    "principal_amount": 300000,
    "interest_rate": 4.5,
    "loan_term_months": 360,
    "loan_start_date": "2026-01-01"
  }' \
  | jq '.'
```

### 5.3 List All Liabilities
```bash
curl -X GET "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 5.4 Update Liability
```bash
curl -X PUT "${API_BASE}/liabilities/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 4500
  }' \
  | jq '.'
```

### 5.5 Delete Liability
```bash
curl -X DELETE "${API_BASE}/liabilities/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 6. Custom Charts

### 6.1 Create Custom Chart
```bash
curl -X POST "${API_BASE}/custom_charts" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Income and Expenses",
    "chart_type": "line",
    "display_type": "both",
    "data_sources": "assets,liabilities,income,expenses",
    "series_configurations": "[{\"data_type\":\"income\",\"field\":\"value\",\"aggregation\":\"sum\",\"label\":\"Income\",\"color\":\"#3b82f6\",\"category\":\"\",\"selected_item_id\":null},{\"data_type\":\"expenses\",\"field\":\"value\",\"aggregation\":\"sum\",\"label\":\"401K deduction\",\"color\":\"#ef4444\",\"category\":\"Investment\",\"selected_item_id\":2}]",
    "x_axis_label": "Year",
    "y_axis_label": "Value"
  }' \
  | jq '.'
```

### 6.2 List All Charts
```bash
curl -X GET "${API_BASE}/custom_charts" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 6.3 Get Specific Chart
```bash
curl -X GET "${API_BASE}/custom_charts/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 6.4 Update Chart
```bash
curl -X PUT "${API_BASE}/custom_charts/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Chart Name",
    "series_configurations": "[{\"data_type\":\"income\",\"field\":\"value\",\"aggregation\":\"sum\",\"label\":\"Income\",\"color\":\"#3b82f6\"}]"
  }' \
  | jq '.'
```

### 6.5 Recalculate Single Chart
```bash
curl -X POST "${API_BASE}/custom_charts/1/recalculate" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 6.6 Recalculate All Charts
```bash
curl -X POST "${API_BASE}/custom_charts/recalculate-all" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 6.7 Delete Chart
```bash
curl -X DELETE "${API_BASE}/custom_charts/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 7. Projections

### 7.1 Create Projection
```bash
curl -X POST "${API_BASE}/projections" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_name": "Test Projection",
    "years": 30,
    "accounts": [
      {
        "name": "Test Asset",
        "account_type": "asset",
        "initial_value": 100000,
        "contribution": 0,
        "growth_rate": 5.0
      }
    ]
  }' \
  | jq '.'
```

### 7.2 List All Projections
```bash
curl -X GET "${API_BASE}/projections" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 7.3 Get Projection Details
```bash
curl -X GET "${API_BASE}/projections/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 7.4 Update Projection
```bash
curl -X PUT "${API_BASE}/projections/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_name": "Updated Projection",
    "years": 35,
    "accounts": [
      {
        "name": "Updated Asset",
        "account_type": "asset",
        "initial_value": 150000,
        "contribution": 0,
        "growth_rate": 6.0
      }
    ]
  }' \
  | jq '.'
```

### 7.5 Delete Projection
```bash
curl -X DELETE "${API_BASE}/projections/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 8. Accounts

### 8.1 Create Account
```bash
curl -X POST "${API_BASE}/accounts/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "brokerage_id": 1,
    "account_name": "Test Account",
    "account_type": "401k"
  }' \
  | jq '.'
```

### 8.2 List All Accounts
```bash
curl -X GET "${API_BASE}/accounts/" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 8.3 Get Specific Account
```bash
curl -X GET "${API_BASE}/accounts/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 8.4 Update Account
```bash
curl -X PUT "${API_BASE}/accounts/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_name": "Updated Account Name"
  }' \
  | jq '.'
```

### 8.5 Delete Account
```bash
curl -X DELETE "${API_BASE}/accounts/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 9. Auto-Disbursements

### 9.1 Create Auto-Disbursement
```bash
curl -X POST "${API_BASE}/auto_disbursements/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "source_asset_id": 1,
    "destination_asset_id": 2,
    "amount": 5000,
    "frequency": "yearly",
    "start_date": "2026-01-01",
    "end_date": null
  }' \
  | jq '.'
```

### 9.2 List All Auto-Disbursements
```bash
curl -X GET "${API_BASE}/auto_disbursements/" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 9.3 Update Auto-Disbursement
```bash
curl -X PUT "${API_BASE}/auto_disbursements/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 6000
  }' \
  | jq '.'
```

### 9.4 Delete Auto-Disbursement
```bash
curl -X DELETE "${API_BASE}/auto_disbursements/1" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 10. User Settings

### 10.1 Get User Settings
```bash
curl -X GET "${API_BASE}/settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

### 10.2 Update User Settings
```bash
curl -X PUT "${API_BASE}/settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "default_inflation_percent": 2.5,
    "projection_years": 35
  }' \
  | jq '.'
```

---

## 11. Testing Scripts

### 11.1 Complete Test Flow (Create, Test, Delete)

Save this as `test_flow.sh`:

```bash
#!/bin/bash

# Set your API base URL and credentials
export API_BASE="http://localhost:8000"
export EMAIL="test@example.com"
export PASSWORD="testpassword"

# Get token
TOKEN=$(curl -s -X POST "${API_BASE}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${EMAIL}&password=${PASSWORD}" \
  | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to get token"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."

# Create asset
ASSET_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0
  }' | jq -r '.id')

echo "Created asset ID: $ASSET_ID"

# Create income
INCOME_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary",
    "description": "Test Salary",
    "frequency": "monthly",
    "value": 8333.33,
    "annual_increase_percent": 3.0
  }' | jq -r '.id')

echo "Created income ID: $INCOME_ID"

# Create expense linked to income
EXPENSE_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": false,
    \"category\": \"Investment\",
    \"description\": \"401K Test\",
    \"frequency\": \"yearly\",
    \"value\": 0,
    \"linked_item_id\": ${INCOME_ID},
    \"linked_item_type\": \"income\",
    \"percentage\": 10.0
  }" | jq -r '.id')

echo "Created expense ID: $EXPENSE_ID"

# Create chart
CHART_ID=$(curl -s -X POST "${API_BASE}/custom_charts" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Chart\",
    \"chart_type\": \"line\",
    \"display_type\": \"chart\",
    \"data_sources\": \"income,expenses\",
    \"series_configurations\": \"[{\\\"data_type\\\":\\\"income\\\",\\\"field\\\":\\\"value\\\",\\\"aggregation\\\":\\\"sum\\\",\\\"label\\\":\\\"Income\\\",\\\"color\\\":\\\"#3b82f6\\\"},{\\\"data_type\\\":\\\"expenses\\\",\\\"field\\\":\\\"value\\\",\\\"aggregation\\\":\\\"sum\\\",\\\"label\\\":\\\"401K Test\\\",\\\"color\\\":\\\"#ef4444\\\",\\\"category\\\":\\\"Investment\\\",\\\"selected_item_id\\\":${EXPENSE_ID}}]\"
  }" | jq -r '.id')

echo "Created chart ID: $CHART_ID"

# Get chart data
echo "Chart data:"
curl -s -X GET "${API_BASE}/custom_charts/${CHART_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.data_json[0:3]'  # Show first 3 years

# Cleanup
echo "Cleaning up..."
curl -s -X DELETE "${API_BASE}/custom_charts/${CHART_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

echo "Test complete!"
```

Make it executable and run:
```bash
chmod +x test_flow.sh
./test_flow.sh
```

---

## 12. Common Patterns

### 12.1 Pretty Print JSON (requires `jq`)
Add `| jq '.'` to any command to format JSON output.

### 12.2 Save Response to File
```bash
curl -X GET "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  > assets.json
```

### 12.3 Extract Specific Field
```bash
curl -X GET "${API_BASE}/assets/1" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq -r '.value'
```

### 12.4 Filter Results
```bash
curl -X GET "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.[] | select(.category == "Investment")'
```

### 12.5 Count Items
```bash
curl -X GET "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq 'length'
```

---

## 13. Error Handling

### 13.1 Check HTTP Status
```bash
curl -w "\nHTTP Status: %{http_code}\n" \
  -X GET "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 13.2 Show Headers
```bash
curl -i -X GET "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 13.3 Verbose Output (for debugging)
```bash
curl -v -X GET "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 14. Notes

1. **Token Expiration**: Tokens expire after a set time (default: 30 minutes). Re-authenticate if you get 401 errors.

2. **JSON Escaping**: When embedding JSON in shell scripts, escape quotes with `\"` or use single quotes for the outer string.

3. **Date Format**: Use ISO 8601 format: `YYYY-MM-DD` (e.g., `2026-01-01`)

4. **Null Values**: Use `null` (not `"null"`) in JSON for optional fields.

5. **Testing**: Start with simple operations (GET) before complex ones (POST/PUT with relationships).

6. **Rate Limiting**: Be mindful of API rate limits in production.

---

## 15. Quick Reference

| Operation | Method | Endpoint Pattern |
|-----------|--------|------------------|
| List | GET | `/resource/` |
| Get One | GET | `/resource/{id}` |
| Create | POST | `/resource/` |
| Update | PUT | `/resource/{id}` |
| Delete | DELETE | `/resource/{id}` |

**Common Resources:**
- Assets: `/assets/`
- Income: `/cashflow?is_income=true`
- Expenses: `/cashflow?is_income=false`
- Liabilities: `/liabilities/`
- Charts: `/custom_charts`
- Projections: `/projections`
- Accounts: `/accounts/`

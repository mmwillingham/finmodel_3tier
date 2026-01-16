# Comprehensive Testing Plan with cURL Commands

This plan provides complete testing scenarios with cURL commands for setup, expected values, and cleanup.

## Prerequisites

### 1. Set Environment Variables
```bash
export API_BASE="http://localhost:8000"  # Adjust for your environment
export EMAIL="test@example.com"          # Your test user email
export PASSWORD="testpassword"            # Your test user password
```

### 2. Get Authentication Token
```bash
# Login and get token
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
```

### 3. Helper Functions (Optional - add to your shell script)
```bash
# Function to extract ID from response
extract_id() {
  echo "$1" | jq -r '.id'
}

# Function to cleanup all test data
cleanup_all() {
  echo "Cleaning up all test data..."
  # This will be populated as we create items
}
```

---

## 1. Asset Calculations

### 1.1 Basic Asset Growth

**Setup:**
```bash
# Create asset
ASSET_1_1_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 1.1",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

echo "Created Asset ID: $ASSET_1_1_ID"
```

**Expected Values:**
- Year 1 (2025): $100,000.00
- Year 2 (2026): $105,000.00 (100,000 * 1.05)
- Year 3 (2027): $110,250.00 (105,000 * 1.05)
- Year 4 (2028): $115,762.50 (110,250 * 1.05)

**Verify in:**
- Custom Charts (asset value over time)
- Balance Sheet Projections
- Cash Flow Overview > BASE Model

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/assets/${ASSET_1_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Asset ID: $ASSET_1_1_ID"
```

---

### 1.2 Asset with Partial Year

**Setup:**
```bash
# Create asset starting mid-year
ASSET_1_2_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 1.2",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": "2026-07-01",
    "end_date": null
  }' | jq -r '.id')

echo "Created Asset ID: $ASSET_1_2_ID"
```

**Expected Values:**
- Year 2026: ~$102,469.51 (half year: 100,000 * 1.05^0.5)
- Year 2027: ~$107,592.99 (full year from 2026 end value: 102,469.51 * 1.05)
- Year 2028: ~$112,972.64 (107,592.99 * 1.05)

**Verify in:**
- All projections and charts

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/assets/${ASSET_1_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Asset ID: $ASSET_1_2_ID"
```

---

### 1.3 Asset with End Date

**Setup:**
```bash
# Create asset with end date
ASSET_1_3_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 1.3",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": "2026-01-01",
    "end_date": "2027-06-30"
  }' | jq -r '.id')

echo "Created Asset ID: $ASSET_1_3_ID"
```

**Expected Values:**
Year 2026: $105,000 (full year: 100,000 * 1.05) — asset active all year
Year 2027: $0 (asset ends June 30, so end-of-year value is 0)
Year 2028: $0 (asset no longer exists)

**Verify in:**
- All projections and charts

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/assets/${ASSET_1_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Asset ID: $ASSET_1_3_ID"
```

---

### 1.4 Multiple Assets with Different Growth Rates

**Setup:**
```bash
# Create Asset 1
ASSET_1_4A_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 1.4A",
    "category": "Investment",
    "value": 50000,
    "annual_increase_percent": 3.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create Asset 2
ASSET_1_4B_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 1.4B",
    "category": "Investment",
    "value": 50000,
    "annual_increase_percent": 7.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

echo "Created Asset IDs: $ASSET_1_4A_ID, $ASSET_1_4B_ID"
```

**Expected Values (Year 1):**
- Asset 1.4A: $50,000.00
- Asset 1.4B: $50,000.00
- Total: $100,000.00

**Expected Values (Year 2):**
- Asset 1.4A: $51,500.00 (50,000 * 1.03)
- Asset 1.4B: $53,500.00 (50,000 * 1.07)
- Total: $105,000.00

**Expected Values (Year 3):**
- Asset 1.4A: $53,045.00 (51,500 * 1.03)
- Asset 1.4B: $57,245.00 (53,500 * 1.07)
- Total: $110,290.00

**Verify in:**
- Custom Charts (aggregated vs itemized)
- Balance Sheet Projections

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/assets/${ASSET_1_4A_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_1_4B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Asset IDs: $ASSET_1_4A_ID, $ASSET_1_4B_ID"
```

---

## 2. Income Calculations

### 2.1 Fixed Income with Growth

**Setup:**
```bash
# Create income
INCOME_2_1_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 2.1",
    "frequency": "yearly",
    "value": 100000,
    "annual_increase_percent": 3.0,
    "start_date": null,
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

echo "Created Income ID: $INCOME_2_1_ID"
```

**Expected Values:**
- Year 1: $100,000.00
- Year 2: $103,000.00 (100,000 * 1.03)
- Year 3: $106,090.00 (103,000 * 1.03)
- Year 4: $109,272.70 (106,090 * 1.03)

**Verify in:**
- Custom Charts
- Cash Flow Overview (all views)
- BASE Model

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_2_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income ID: $INCOME_2_1_ID"
```

---

### 2.2 Income with Partial Year

**Setup:**
```bash
# Create income with partial year
INCOME_2_2_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 2.2",
    "frequency": "yearly",
    "value": 200000,
    "annual_increase_percent": 0.0,
    "start_date": "2026-01-01",
    "end_date": "2027-08-31",
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

echo "Created Income ID: $INCOME_2_2_ID"
```

**Expected Values:**
- Year 2026: $200,000.00 (full 12 months)
- Year 2027: ~$133,333.33 (8 months: 200,000 * 8/12)
- Year 2028: $0.00

**Verify in:**
- All projections (especially BASE Model)

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_2_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income ID: $INCOME_2_2_ID"
```

---

### 2.3 Dynamic Income Linked to Asset

**Setup:**
```bash
# First create the asset
ASSET_2_3_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 2.3",
    "category": "Investment",
    "value": 1000000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create income linked to asset (4% of asset value)
INCOME_2_3_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": true,
    \"category\": \"Investment\",
    \"description\": \"Test Income 2.3\",
    \"frequency\": \"yearly\",
    \"value\": 0,
    \"annual_increase_percent\": 0,
    \"start_date\": null,
    \"end_date\": null,
    \"taxable\": true,
    \"linked_item_id\": ${ASSET_2_3_ID},
    \"linked_item_type\": \"asset\",
    \"percentage\": 4.0,
    \"person\": \"Family\"
  }" | jq -r '.id')

echo "Created Asset ID: $ASSET_2_3_ID, Income ID: $INCOME_2_3_ID"
```

**Expected Values:**
- Year 1:
  - Asset: $1,050,000.00 (1,000,000 * 1.05)
  - Income: $40,000.00 (1,000,000 * 0.04) - based on beginning asset value
- Year 2:
  - Asset: $1,102,500.00 (1,050,000 * 1.05)
  - Income: $42,000.00 (1,050,000 * 0.04) - based on previous year's asset value
- Year 3:
  - Asset: $1,157,625.00 (1,102,500 * 1.05)
  - Income: $44,100.00 (1,102,500 * 0.04)

**Verify in:**
- Custom Charts
- Cash Flow Overview
- Verify income recalculates each year (not using stale values)

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_2_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_2_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income ID: $INCOME_2_3_ID, Asset ID: $ASSET_2_3_ID"
```

---

## 3. Expense Calculations

### 3.1 Fixed Expense with Inflation

**Setup:**
```bash
# Create expense
EXPENSE_3_1_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Clothing",
    "description": "Test Expense 3.1",
    "frequency": "yearly",
    "value": 10000,
    "inflation_percent": 2.0,
    "start_date": null,
    "end_date": null,
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

echo "Created Expense ID: $EXPENSE_3_1_ID"
```

**Expected Values:**
- Year 1: $10,000.00
- Year 2: $10,200.00 (10,000 * 1.02)
- Year 3: $10,404.00 (10,200 * 1.02)
- Year 4: $10,612.08 (10,404 * 1.02)

**Verify in:**
- Custom Charts
- Cash Flow Overview

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_3_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Expense ID: $EXPENSE_3_1_ID"
```

---

### 3.2 Expense with Partial Year

**Setup:**
```bash
# Create expense with partial year
EXPENSE_3_2_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Clothing",
    "description": "Test Expense 3.2",
    "frequency": "yearly",
    "value": 12000,
    "inflation_percent": 0.0,
    "start_date": "2026-03-01",
    "end_date": "2027-12-31",
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

echo "Created Expense ID: $EXPENSE_3_2_ID"
```

**Expected Values:**
- Year 2026: ~$10,000.00 (10 months: 12,000 * 10/12)
- Year 2027: $12,000.00 (full year)
- Year 2028: $0.00

**Verify in:**
- All projections

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_3_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Expense ID: $EXPENSE_3_2_ID"
```

---

### 3.3 Dynamic Expense Linked to Income (401K-style)

**Setup:**
```bash
# First create income
INCOME_3_3_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 3.3",
    "frequency": "yearly",
    "value": 200000,
    "annual_increase_percent": 0.0,
    "start_date": "2026-01-01",
    "end_date": "2027-08-31",
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create asset for 401K contribution
ASSET_3_3_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "401K Account",
    "category": "Investment",
    "value": 0,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create expense linked to income (10% of income)
EXPENSE_3_3_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": false,
    \"category\": \"Investments\",
    \"description\": \"401K deduction\",
    \"frequency\": \"yearly\",
    \"value\": 0,
    \"inflation_percent\": 0,
    \"start_date\": \"2026-01-01\",
    \"end_date\": null,
    \"tax_deductible\": true,
    \"linked_item_id\": ${INCOME_3_3_ID},
    \"linked_item_type\": \"income\",
    \"percentage\": 10.0,
    \"person\": \"Family\",
    \"contributes_to_asset_id\": ${ASSET_3_3_ID}
  }" | jq -r '.id')

echo "Created Income ID: $INCOME_3_3_ID, Asset ID: $ASSET_3_3_ID, Expense ID: $EXPENSE_3_3_ID"
```

**Expected Values:**
- Year 2026:
  - Income = $200,000.00 (full year)
  - Expense = $20,000.00 (200,000 * 0.10)
  - Asset (end of year) = $20,000.00 (contribution from expense)
- Year 2027:
  - Income = ~$133,150.68 (8 months: 200,000 * 243/365)
  - Expense = ~$13,315.07 (prorated income * 0.10)
  - Asset (beginning) = $21,000.00 (previous year * 1.05)
  - Asset (end of year) = $34,315.07 (21,000 + 13,315.07 contribution)
- Year 2028:
  - Income = $0.00 (income ended)
  - Expense = $0.00 (income ended)
  - Asset (end of year) = $36,030.82 (previous year * 1.05, no new contributions)
- **CRITICAL:** Expense must drop to $0 when income ends

**Verify in:**
- Custom Charts (expense should match income pattern)
- Cash Flow Overview (all views)
- Balance Sheet Projections
- Verify expense recalculates each year (not using stale values)

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_3_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_3_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_3_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Expense ID: $EXPENSE_3_3_ID, Income ID: $INCOME_3_3_ID, Asset ID: $ASSET_3_3_ID"
```

---

### 3.4 Expense Contributing to Asset

**Setup:**
```bash
# Create asset (destination)
ASSET_3_4_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 3.4",
    "category": "Investment",
    "value": 0,
    "annual_increase_percent": 0.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create expense
EXPENSE_3_4_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": false,
    \"category\": \"Investments\",
    \"description\": \"Test Expense 3.4\",
    \"frequency\": \"yearly\",
    \"value\": 10000,
    \"inflation_percent\": 0.0,
    \"start_date\": null,
    \"end_date\": null,
    \"tax_deductible\": false,
    \"linked_item_id\": null,
    \"linked_item_type\": null,
    \"percentage\": null,
    \"person\": \"Family\",
    \"contributes_to_asset_id\": ${ASSET_3_4_ID}
  }" | jq -r '.id')

echo "Created Asset ID: $ASSET_3_4_ID, Expense ID: $EXPENSE_3_4_ID"
```

**Expected Values:**
- Year 1: Asset = $10,000.00
- Year 2: Asset = $20,000.00
- Year 3: Asset = $30,000.00

**Verify in:**
- Balance Sheet Projections
- Custom Charts

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_3_4_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_3_4_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Expense ID: $EXPENSE_3_4_ID, Asset ID: $ASSET_3_4_ID"
```

---

## 4. Liability Calculations

### 4.1 Simple Liability (Fixed)

**Setup:**
```bash
# Create liability
LIABILITY_4_1_ID=$(curl -s -X POST "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Liability 4.1",
    "category": "Debt",
    "value": 50000,
    "annual_increase_percent": 0,
    "loan_type": "ordinary",
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

echo "Created Liability ID: $LIABILITY_4_1_ID"
```

**Expected Values:**
- Year 1: $50,000.00
- Year 2: $50,000.00
- Year 3: $50,000.00
- Value remains constant

**Verify in:**
- Balance Sheet Projections
- Custom Charts

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/liabilities/${LIABILITY_4_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Liability ID: $LIABILITY_4_1_ID"
```

---

### 4.2 Liability with Growth

**Setup:**
```bash
# Create liability with growth
LIABILITY_4_2_ID=$(curl -s -X POST "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Liability 4.2",
    "category": "Debt",
    "value": 50000,
    "annual_increase_percent": 3.0,
    "loan_type": "ordinary",
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

echo "Created Liability ID: $LIABILITY_4_2_ID"
```

**Expected Values:**
- Year 1: $50,000.00
- Year 2: $51,500.00 (50,000 * 1.03)
- Year 3: $53,045.00 (51,500 * 1.03)

**Verify in:**
- All projections

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/liabilities/${LIABILITY_4_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Liability ID: $LIABILITY_4_2_ID"
```

---

### 4.3 Amortized Loan

**Setup:**
```bash
# Create amortized loan
LIABILITY_4_3_ID=$(curl -s -X POST "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Mortgage 4.3",
    "category": "Debt",
    "value": 100000,
    "annual_increase_percent": 0,
    "loan_type": "amortized",
    "principal_amount": 100000,
    "interest_rate": 5.0,
    "loan_term_months": 360,
    "loan_start_date": "2026-01-01",
    "start_date": "2026-01-01",
    "end_date": null,
    "include_in_cash_flow": false
  }' | jq -r '.id')

echo "Created Liability ID: $LIABILITY_4_3_ID"
```

**Expected Values (approximate - actual depends on payment calculation):**
- Year 1: Balance ≈ $98,000 (after 12 months of payments)
- Year 2: Balance ≈ $96,000
- Year 3: Balance ≈ $94,000
- Balance decreases over time
- Final year: Balance = $0

**Note:** Monthly payment will be calculated automatically. For a $100,000 loan at 5% for 30 years, monthly payment ≈ $536.82.

**Verify in:**
- Balance Sheet Projections
- Custom Charts (liability balance over time)

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/liabilities/${LIABILITY_4_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Liability ID: $LIABILITY_4_3_ID"
```

---

### 4.4 Amortized Loan with Payment Expense

**Setup:**
```bash
# Create amortized loan with payment expense
LIABILITY_4_4_ID=$(curl -s -X POST "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Mortgage 4.4",
    "category": "Debt",
    "value": 100000,
    "annual_increase_percent": 0,
    "loan_type": "amortized",
    "principal_amount": 100000,
    "interest_rate": 5.0,
    "loan_term_months": 120,
    "loan_start_date": "2026-01-01",
    "start_date": "2026-01-01",
    "end_date": null,
    "include_in_cash_flow": true,
    "expense_category": "Housing"
  }' | jq -r '.id')

# Get the created expense ID (it's auto-created)
# Note: You'll need to query the cashflow endpoint to find the expense
EXPENSE_4_4_ID=$(curl -s -X GET "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq -r ".[] | select(.linked_item_id == ${LIABILITY_4_4_ID} and .linked_item_type == \"liability\") | .id")

echo "Created Liability ID: $LIABILITY_4_4_ID, Expense ID: $EXPENSE_4_4_ID"
```

**Expected Values:**
- Year 1: Liability balance decreases (principal payment portion)
- Year 1: Expense = annual payment amount (12 * monthly payment ≈ $12,727.92 for 10-year loan)
- Year 2: Liability balance continues decreasing
- Year 2: Expense continues at payment amount
- Final year: Liability balance = $0

**Verify in:**
- Balance Sheet Projections (liability balance)
- Cash Flow Overview (expense amount)
- Custom Charts (both liability and expense)

**Cleanup:**
```bash
# Delete expense first (if it exists)
if [ ! -z "$EXPENSE_4_4_ID" ] && [ "$EXPENSE_4_4_ID" != "null" ]; then
  curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_4_4_ID}" \
    -H "Authorization: Bearer ${TOKEN}"
fi
curl -s -X DELETE "${API_BASE}/liabilities/${LIABILITY_4_4_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Liability ID: $LIABILITY_4_4_ID, Expense ID: $EXPENSE_4_4_ID"
```

---

## 5. Tax Calculations

### 5.1 Federal Income Tax (Calculated)

**Setup:**
```bash
# Create income
INCOME_5_1_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 5.1",
    "frequency": "yearly",
    "value": 100000,
    "annual_increase_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Enable federal tax calculation in settings
curl -s -X PUT "${API_BASE}/settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": true
  }' | jq '.'

echo "Created Income ID: $INCOME_5_1_ID"
echo "Enabled federal tax calculation"
```

**Expected Values:**
- Federal tax calculated based on tax brackets
- Tax appears as expense in projections
- Tax amount matches expected bracket calculation
- For $100,000 taxable income (Single, 2025): ~$17,400 (approximate)

**Verify in:**
- Cash Flow Overview
- Custom Charts (expense category "Taxes")
- BASE Model

**Cleanup:**
```bash
# Disable federal tax calculation
curl -s -X PUT "${API_BASE}/settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": false
  }' | jq '.'

curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_5_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income ID: $INCOME_5_1_ID"
echo "Disabled federal tax calculation"
```

---

### 5.2 Tax with Multiple Income Sources

**Setup:**
```bash
# Create Income 1
INCOME_5_2A_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 5.2A",
    "frequency": "yearly",
    "value": 80000,
    "annual_increase_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create Income 2
INCOME_5_2B_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 5.2B",
    "frequency": "yearly",
    "value": 20000,
    "annual_increase_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Enable federal tax calculation
curl -s -X PUT "${API_BASE}/settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": true
  }' | jq '.'

echo "Created Income IDs: $INCOME_5_2A_ID, $INCOME_5_2B_ID"
```

**Expected Values:**
- Total taxable income = $100,000.00
- Tax calculated on total, not individual
- Tax matches single $100,000 income scenario (~$17,400)

**Verify in:**
- All projections

**Cleanup:**
```bash
curl -s -X PUT "${API_BASE}/settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": false
  }' | jq '.'

curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_5_2A_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_5_2B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income IDs: $INCOME_5_2A_ID, $INCOME_5_2B_ID"
```

---

### 5.3 Tax with Non-Taxable Income

**Setup:**
```bash
# Create taxable income
INCOME_5_3A_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 5.3A (Taxable)",
    "frequency": "yearly",
    "value": 100000,
    "annual_increase_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create non-taxable income
INCOME_5_3B_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Investment",
    "description": "Test Income 5.3B (Non-Taxable)",
    "frequency": "yearly",
    "value": 20000,
    "annual_increase_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "taxable": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Enable federal tax calculation
curl -s -X PUT "${API_BASE}/settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": true
  }' | jq '.'

echo "Created Income IDs: $INCOME_5_3A_ID, $INCOME_5_3B_ID"
```

**Expected Values:**
- Taxable income = $100,000.00 (not $120,000)
- Tax calculated only on taxable portion (~$17,400)
- Total income = $120,000.00, but tax based on $100,000

**Verify in:**
- All projections

**Cleanup:**
```bash
curl -s -X PUT "${API_BASE}/settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": false
  }' | jq '.'

curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_5_3A_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_5_3B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income IDs: $INCOME_5_3A_ID, $INCOME_5_3B_ID"
```

---

## 6. Complex Scenarios

### 6.1 Reinvested Dividends

**Setup:**
```bash
# Create asset
ASSET_6_1_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 6.1",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create income (2% dividends from asset, reinvested)
INCOME_6_1_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": true,
    \"category\": \"Investment\",
    \"description\": \"Dividend Income\",
    \"frequency\": \"yearly\",
    \"value\": 0,
    \"annual_increase_percent\": 0,
    \"start_date\": null,
    \"end_date\": null,
    \"taxable\": true,
    \"linked_item_id\": ${ASSET_6_1_ID},
    \"linked_item_type\": \"asset\",
    \"percentage\": 2.0,
    \"person\": \"Family\",
    \"contributes_to_asset_id\": ${ASSET_6_1_ID}
  }" | jq -r '.id')

echo "Created Asset ID: $ASSET_6_1_ID, Income ID: $INCOME_6_1_ID"
```

**Expected Values:**
- Year 1: Asset = $100,000.00
- Year 1: Dividend income = $2,000.00 (100,000 * 0.02)
- Year 1: Asset after reinvestment = $107,000.00 (100,000 * 1.05 + 2,000) or $102,000.00 (if growth and dividend are separate)
- Year 2: Asset grows from Year 1 end value
- Year 2: Dividend income = 2% of Year 1 end asset value

**Verify in:**
- Custom Charts (income and asset)
- Cash Flow Overview
- Balance Sheet Projections

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_6_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income ID: $INCOME_6_1_ID, Asset ID: $ASSET_6_1_ID"
```

---

### 6.2 Auto-Disbursements

**Setup:**
```bash
# Create source asset
ASSET_6_2A_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 6.2A (Source)",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create destination asset
ASSET_6_2B_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 6.2B (Destination)",
    "category": "Investment",
    "value": 0,
    "annual_increase_percent": 3.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create auto-disbursement
DISBURSEMENT_6_2_ID=$(curl -s -X POST "${API_BASE}/auto_disbursements/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"source_asset_id\": ${ASSET_6_2A_ID},
    \"destination_asset_id\": ${ASSET_6_2B_ID},
    \"amount\": 5000,
    \"frequency\": \"yearly\",
    \"start_date\": \"2026-01-01\",
    \"end_date\": null
  }" | jq -r '.id')

echo "Created Asset IDs: $ASSET_6_2A_ID, $ASSET_6_2B_ID, Disbursement ID: $DISBURSEMENT_6_2_ID"
```

**Expected Values:**
- Year 1: Asset 6.2A = $100,000.00 (before transfer), $95,000.00 (after $5,000 transfer), then grows to $99,750.00 (95,000 * 1.05)
- Year 1: Asset 6.2B = $5,000.00 (receives transfer), then grows to $5,150.00 (5,000 * 1.03)
- Year 2: Asset 6.2A = $99,750.00 (before transfer), $94,750.00 (after transfer), then grows
- Year 2: Asset 6.2B = $5,150.00 + $5,000.00 = $10,150.00 (before growth), then grows

**Verify in:**
- Balance Sheet Projections
- Custom Charts (both assets)

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/auto_disbursements/${DISBURSEMENT_6_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_2A_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_2B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Disbursement ID: $DISBURSEMENT_6_2_ID, Asset IDs: $ASSET_6_2A_ID, $ASSET_6_2B_ID"
```

---

### 6.3 Surplus Asset Transfers

**Setup:**
```bash
# Create income
INCOME_6_3_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 6.3",
    "frequency": "yearly",
    "value": 100000,
    "annual_increase_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create expense
EXPENSE_6_3_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Clothing",
    "description": "Test Expense 6.3",
    "frequency": "yearly",
    "value": 80000,
    "inflation_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create surplus asset
ASSET_6_3_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Surplus Asset",
    "category": "Investment",
    "value": 0,
    "annual_increase_percent": 0.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

echo "Created Income ID: $INCOME_6_3_ID, Expense ID: $EXPENSE_6_3_ID, Asset ID: $ASSET_6_3_ID"
```

**Expected Values:**
- Year 1: Surplus = $20,000.00 (100,000 - 80,000)
- Year 2: Surplus = $40,000.00 (accumulates: 20,000 + 20,000)
- Year 3: Surplus = $60,000.00

**Note:** Surplus transfers are typically configured in user settings. Verify that surplus calculation works: income - expenses.

**Verify in:**
- Cash Flow Overview
- Balance Sheet Projections
- Custom Charts

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_6_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_6_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income ID: $INCOME_6_3_ID, Expense ID: $EXPENSE_6_3_ID, Asset ID: $ASSET_6_3_ID"
```

---

### 6.4 Multiple Linked Items Chain

**Setup:**
```bash
# Create asset
ASSET_6_4_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 6.4",
    "category": "Investment",
    "value": 1000000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create income linked to asset (4% of asset)
INCOME_6_4_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": true,
    \"category\": \"Investment\",
    \"description\": \"Test Income 6.4\",
    \"frequency\": \"yearly\",
    \"value\": 0,
    \"annual_increase_percent\": 0,
    \"start_date\": null,
    \"end_date\": null,
    \"taxable\": true,
    \"linked_item_id\": ${ASSET_6_4_ID},
    \"linked_item_type\": \"asset\",
    \"percentage\": 4.0,
    \"person\": \"Family\"
  }" | jq -r '.id')

# Create destination asset for expense
ASSET_6_4B_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 6.4B",
    "category": "Investment",
    "value": 0,
    "annual_increase_percent": 3.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create expense linked to income (10% of income), contributes to asset
EXPENSE_6_4_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": false,
    \"category\": \"Investments\",
    \"description\": \"Test Expense 6.4\",
    \"frequency\": \"yearly\",
    \"value\": 0,
    \"inflation_percent\": 0,
    \"start_date\": null,
    \"end_date\": null,
    \"tax_deductible\": false,
    \"linked_item_id\": ${INCOME_6_4_ID},
    \"linked_item_type\": \"income\",
    \"percentage\": 10.0,
    \"person\": \"Family\",
    \"contributes_to_asset_id\": ${ASSET_6_4B_ID}
  }" | jq -r '.id')

echo "Created Asset IDs: $ASSET_6_4_ID, $ASSET_6_4B_ID, Income ID: $INCOME_6_4_ID, Expense ID: $EXPENSE_6_4_ID"
```

**Expected Values:**
- Year 1:
  - Asset 6.4: $1,050,000.00 (1,000,000 * 1.05)
  - Income: $40,000.00 (1,000,000 * 0.04)
  - Expense: $4,000.00 (40,000 * 0.10)
  - Asset 6.4B: $4,000.00 (from expense contribution)
- Year 2:
  - Asset 6.4: $1,102,500.00 (1,050,000 * 1.05)
  - Income: $42,000.00 (1,050,000 * 0.04)
  - Expense: $4,200.00 (42,000 * 0.10)
  - Asset 6.4B: $4,000.00 * 1.03 + $4,200.00 = $8,320.00

**Verify in:**
- Custom Charts (all three items)
- Cash Flow Overview
- Verify calculations update when source changes

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_6_4_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_6_4_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_4_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_4B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Expense ID: $EXPENSE_6_4_ID, Income ID: $INCOME_6_4_ID, Asset IDs: $ASSET_6_4_ID, $ASSET_6_4B_ID"
```

---

## 7. Edge Cases

### 7.1 Zero Values

**Setup:**
```bash
# Create asset with zero value
ASSET_7_1_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 7.1",
    "category": "Investment",
    "value": 0,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

# Create income with zero value
INCOME_7_1_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 7.1",
    "frequency": "yearly",
    "value": 0,
    "annual_increase_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create expense with zero value
EXPENSE_7_1_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Clothing",
    "description": "Test Expense 7.1",
    "frequency": "yearly",
    "value": 0,
    "inflation_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

echo "Created Asset ID: $ASSET_7_1_ID, Income ID: $INCOME_7_1_ID, Expense ID: $EXPENSE_7_1_ID"
```

**Expected Values:**
- No division by zero errors
- Charts render correctly (show 0 or empty)
- Calculations handle zero gracefully
- All values remain $0.00

**Verify in:**
- All projections and charts

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_7_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_7_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_7_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Asset ID: $ASSET_7_1_ID, Income ID: $INCOME_7_1_ID, Expense ID: $EXPENSE_7_1_ID"
```

---

### 7.2 Negative Growth Rates

**Setup:**
```bash
# Create asset with negative growth
ASSET_7_2_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 7.2",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": -5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

echo "Created Asset ID: $ASSET_7_2_ID"
```

**Expected Values:**
- Year 1: $100,000.00
- Year 2: $95,000.00 (100,000 * 0.95)
- Year 3: $90,250.00 (95,000 * 0.95)
- Asset decreases over time

**Verify in:**
- All projections

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/assets/${ASSET_7_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Asset ID: $ASSET_7_2_ID"
```

---

### 7.3 Very High Growth Rates

**Setup:**
```bash
# Create asset with high growth
ASSET_7_3_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 7.3",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 50.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

echo "Created Asset ID: $ASSET_7_3_ID"
```

**Expected Values:**
- Year 1: $100,000.00
- Year 2: $150,000.00 (100,000 * 1.50)
- Year 3: $225,000.00 (150,000 * 1.50)
- Calculations handle large numbers correctly

**Verify in:**
- All projections
- Check for overflow/rounding issues

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/assets/${ASSET_7_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Asset ID: $ASSET_7_3_ID"
```

---

### 7.4 Overlapping Date Ranges

**Setup:**
```bash
# Create Income 1
INCOME_7_4A_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 7.4A",
    "frequency": "yearly",
    "value": 100000,
    "annual_increase_percent": 0.0,
    "start_date": "2026-01-01",
    "end_date": "2027-12-31",
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create Income 2 (overlaps with Income 1)
INCOME_7_4B_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 7.4B",
    "frequency": "yearly",
    "value": 50000,
    "annual_increase_percent": 0.0,
    "start_date": "2027-06-01",
    "end_date": "2028-12-31",
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

echo "Created Income IDs: $INCOME_7_4A_ID, $INCOME_7_4B_ID"
```

**Expected Values:**
- Year 2026: Only Income 7.4A = $100,000.00
- Year 2027: Both incomes active (overlap)
  - Income 7.4A: $100,000.00 (full year)
  - Income 7.4B: ~$29,166.67 (7 months: 50,000 * 7/12)
  - Total: ~$129,166.67
- Year 2028: Only Income 7.4B = $50,000.00 (full year)
- Partial year calculations correct for both

**Verify in:**
- All projections

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_7_4A_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_7_4B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Income IDs: $INCOME_7_4A_ID, $INCOME_7_4B_ID"
```

---

## 8. Chart-Specific Tests

### 8.1 Custom Chart - All Items vs Specific Item

**Setup:**
```bash
# Create 3 expenses in "Investments" category
EXPENSE_8_1A_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Investments",
    "description": "Test Expense 8.1A",
    "frequency": "yearly",
    "value": 5000,
    "inflation_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

EXPENSE_8_1B_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Investments",
    "description": "Test Expense 8.1B",
    "frequency": "yearly",
    "value": 3000,
    "inflation_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

EXPENSE_8_1C_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Investments",
    "description": "Test Expense 8.1C",
    "frequency": "yearly",
    "value": 2000,
    "inflation_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create chart with "All Items" for Investment category
CHART_8_1A_ID=$(curl -s -X POST "${API_BASE}/custom_charts" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Chart 8.1A (All Investment Expenses)\",
    \"chart_type\": \"line\",
    \"display_type\": \"both\",
    \"data_sources\": \"expenses\",
    \"series_configurations\": \"[{\\\"data_type\\\":\\\"expenses\\\",\\\"field\\\":\\\"value\\\",\\\"aggregation\\\":\\\"sum\\\",\\\"label\\\":\\\"All Investment Expenses\\\",\\\"color\\\":\\\"#ef4444\\\",\\\"category\\\":\\\"Investments\\\",\\\"selected_item_id\\\":null}]\",
    \"x_axis_label\": \"Year\",
    \"y_axis_label\": \"Value\"
  }" | jq -r '.id')

# Create chart with specific expense
CHART_8_1B_ID=$(curl -s -X POST "${API_BASE}/custom_charts" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Chart 8.1B (Specific Expense)\",
    \"chart_type\": \"line\",
    \"display_type\": \"both\",
    \"data_sources\": \"expenses\",
    \"series_configurations\": \"[{\\\"data_type\\\":\\\"expenses\\\",\\\"field\\\":\\\"value\\\",\\\"aggregation\\\":\\\"sum\\\",\\\"label\\\":\\\"Test Expense 8.1A\\\",\\\"color\\\":\\\"#ef4444\\\",\\\"category\\\":\\\"\\\",\\\"selected_item_id\\\":${EXPENSE_8_1A_ID}}]\",
    \"x_axis_label\": \"Year\",
    \"y_axis_label\": \"Value\"
  }" | jq -r '.id')

echo "Created Expense IDs: $EXPENSE_8_1A_ID, $EXPENSE_8_1B_ID, $EXPENSE_8_1C_ID"
echo "Created Chart IDs: $CHART_8_1A_ID, $CHART_8_1B_ID"
```

**Expected Values:**
- "All Items" chart shows sum of all 3 expenses = $10,000.00 per year
- Specific item chart shows only that expense = $5,000.00 per year
- Values match between charts

**Verify in:**
- Custom Charts

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/custom_charts/${CHART_8_1A_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/custom_charts/${CHART_8_1B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_8_1A_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_8_1B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_8_1C_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Chart IDs: $CHART_8_1A_ID, $CHART_8_1B_ID"
echo "Deleted Expense IDs: $EXPENSE_8_1A_ID, $EXPENSE_8_1B_ID, $EXPENSE_8_1C_ID"
```

---

### 8.2 Custom Chart - Label Changes

**Setup:**
```bash
# Create expense
EXPENSE_8_2_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Investments",
    "description": "401K deduction",
    "frequency": "yearly",
    "value": 20000,
    "inflation_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "tax_deductible": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create chart
CHART_8_2_ID=$(curl -s -X POST "${API_BASE}/custom_charts" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Chart 8.2\",
    \"chart_type\": \"line\",
    \"display_type\": \"both\",
    \"data_sources\": \"expenses\",
    \"series_configurations\": \"[{\\\"data_type\\\":\\\"expenses\\\",\\\"field\\\":\\\"value\\\",\\\"aggregation\\\":\\\"sum\\\",\\\"label\\\":\\\"401K\\\",\\\"color\\\":\\\"#ef4444\\\",\\\"category\\\":\\\"\\\",\\\"selected_item_id\\\":${EXPENSE_8_2_ID}}]\",
    \"x_axis_label\": \"Year\",
    \"y_axis_label\": \"Value\"
  }" | jq -r '.id')

echo "Created Expense ID: $EXPENSE_8_2_ID, Chart ID: $CHART_8_2_ID"
```

**Test Steps:**
1. View chart - should show $20,000.00 per year
2. Edit chart, change label from "401K" to "Retirement Savings"
3. Save chart
4. View chart again - should still show $20,000.00 per year (label changed, data unchanged)

**Expected Values:**
- Chart still shows correct data after label change
- No recalculation needed
- Label is display-only

**Verify in:**
- Custom Charts (edit chart, change label, save)

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/custom_charts/${CHART_8_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_8_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Chart ID: $CHART_8_2_ID, Expense ID: $EXPENSE_8_2_ID"
```

---

### 8.3 Chart Recalculation

**Setup:**
```bash
# Create income
INCOME_8_3_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Test Income 8.3",
    "frequency": "yearly",
    "value": 100000,
    "annual_increase_percent": 0.0,
    "start_date": null,
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')

# Create chart
CHART_8_3_ID=$(curl -s -X POST "${API_BASE}/custom_charts" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Chart 8.3\",
    \"chart_type\": \"line\",
    \"display_type\": \"both\",
    \"data_sources\": \"income\",
    \"series_configurations\": \"[{\\\"data_type\\\":\\\"income\\\",\\\"field\\\":\\\"value\\\",\\\"aggregation\\\":\\\"sum\\\",\\\"label\\\":\\\"Income\\\",\\\"color\\\":\\\"#3b82f6\\\",\\\"category\\\":\\\"\\\",\\\"selected_item_id\\\":${INCOME_8_3_ID}}]\",
    \"x_axis_label\": \"Year\",
    \"y_axis_label\": \"Value\"
  }" | jq -r '.id')

echo "Created Income ID: $INCOME_8_3_ID, Chart ID: $CHART_8_3_ID"
```

**Test Steps:**
1. View chart - should show $100,000.00 per year
2. Update income amount to $150,000
3. Recalculate chart
4. View chart again - should show $150,000.00 per year

**Expected Values:**
- Chart updates with new values
- Old data replaced correctly
- No duplicate or stale data

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/custom_charts/${CHART_8_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_8_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Chart ID: $CHART_8_3_ID, Income ID: $INCOME_8_3_ID"
```

---

## 9. Complete Test Script Template

Save this as `run_all_tests.sh`:

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
  echo "ERROR: Failed to get token"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."
echo ""
echo "========================================="
echo "Running Test Suite"
echo "========================================="
echo ""

# Track created IDs for cleanup
ASSET_IDS=()
INCOME_IDS=()
EXPENSE_IDS=()
LIABILITY_IDS=()
CHART_IDS=()
DISBURSEMENT_IDS=()

# Function to cleanup all
cleanup_all() {
  echo ""
  echo "========================================="
  echo "Cleaning up all test data..."
  echo "========================================="
  
  for id in "${CHART_IDS[@]}"; do
    curl -s -X DELETE "${API_BASE}/custom_charts/${id}" \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
  done
  
  for id in "${DISBURSEMENT_IDS[@]}"; do
    curl -s -X DELETE "${API_BASE}/auto_disbursements/${id}" \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
  done
  
  for id in "${EXPENSE_IDS[@]}"; do
    curl -s -X DELETE "${API_BASE}/cashflow/${id}" \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
  done
  
  for id in "${INCOME_IDS[@]}"; do
    curl -s -X DELETE "${API_BASE}/cashflow/${id}" \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
  done
  
  for id in "${LIABILITY_IDS[@]}"; do
    curl -s -X DELETE "${API_BASE}/liabilities/${id}" \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
  done
  
  for id in "${ASSET_IDS[@]}"; do
    curl -s -X DELETE "${API_BASE}/assets/${id}" \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
  done
  
  echo "Cleanup complete!"
}

# Trap to cleanup on exit
trap cleanup_all EXIT

# Run your tests here...
# Example:
echo "Running Test 1.1: Basic Asset Growth"
ASSET_1_1_ID=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset 1.1",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')

ASSET_IDS+=("$ASSET_1_1_ID")
echo "Created Asset ID: $ASSET_1_1_ID"
echo "Test 1.1 complete!"
echo ""

# Add more tests...

echo ""
echo "========================================="
echo "All tests complete!"
echo "========================================="
```

Make it executable:
```bash
chmod +x run_all_tests.sh
./run_all_tests.sh
```

---

## Notes

1. **Token Expiration**: Tokens expire after a set time. Re-authenticate if you get 401 errors.

2. **Date Format**: Use ISO 8601 format: `YYYY-MM-DD` (e.g., `2026-01-01`)

3. **Null Values**: Use `null` (not `"null"`) in JSON for optional fields.

4. **ID Extraction**: The scripts use `jq -r '.id'` to extract IDs from responses. Install `jq` if needed:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install jq
   
   # macOS
   brew install jq
   ```

5. **Error Handling**: Check HTTP status codes and response bodies for errors.

6. **Testing Order**: Some tests depend on others (e.g., dynamic items require source items). Follow the order in this document.

7. **Expected Values**: Values are approximate and may vary slightly due to rounding or calculation methods. Focus on the pattern and relative correctness.

8. **Verification**: After running setup commands, verify in the UI:
   - Custom Charts
   - Balance Sheet Projections
   - Cash Flow Overview
   - BASE Model
   - Monte Carlo Projections

---

## Quick Reference

| Resource | Create | List | Get | Update | Delete |
|----------|--------|------|-----|--------|--------|
| Assets | `POST /assets/` | `GET /assets/` | `GET /assets/{id}` | `PUT /assets/{id}` | `DELETE /assets/{id}` |
| Income | `POST /cashflow?is_income=true` | `GET /cashflow?is_income=true` | `GET /cashflow/{id}` | `PUT /cashflow/{id}` | `DELETE /cashflow/{id}` |
| Expenses | `POST /cashflow?is_income=false` | `GET /cashflow?is_income=false` | `GET /cashflow/{id}` | `PUT /cashflow/{id}` | `DELETE /cashflow/{id}` |
| Liabilities | `POST /liabilities/` | `GET /liabilities/` | `GET /liabilities/{id}` | `PUT /liabilities/{id}` | `DELETE /liabilities/{id}` |
| Charts | `POST /custom_charts` | `GET /custom_charts` | `GET /custom_charts/{id}` | `PUT /custom_charts/{id}` | `DELETE /custom_charts/{id}` |
| Auto-Disbursements | `POST /auto_disbursements/` | `GET /auto_disbursements/` | `GET /auto_disbursements/{id}` | `PUT /auto_disbursements/{id}` | `DELETE /auto_disbursements/{id}` |

---

**End of Testing Plan**

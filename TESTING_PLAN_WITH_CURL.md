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

**Description:** Tests basic asset growth calculation with a simple asset that starts at $100,000 and grows at 5% annually. This verifies that compound growth is calculated correctly over multiple years.

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

**Description:** Tests asset growth calculation when an asset starts mid-year (July 1, 2026). Verifies that partial year calculations use compound growth correctly (e.g., 1.05^0.5 for half a year).

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

**Description:** Tests asset behavior when an asset has an end date (ends June 30, 2027). Verifies that the asset value is $0 at end of year 2027 and beyond, even if the asset existed for part of that year.

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

**Description:** Tests multiple assets with different growth rates (3% and 7%) to verify that each asset grows independently and totals are calculated correctly across different assets.

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

**Description:** Tests fixed income calculation with annual growth (3% per year). Verifies that income values increase according to the growth rate and compound over multiple years.

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

**Description:** Tests income calculation when an income item is active for only part of the year (Jan 1, 2026 to Aug 31, 2027). Verifies that income is prorated correctly based on the fraction of the year the item is active.

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

**Description:** Tests dynamic income that is calculated as a percentage (4%) of an asset's value each year. Verifies that the income amount increases as the asset grows, and that the income reflects the current asset value dynamically.

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

**Description:** Tests fixed expense calculation with annual inflation (2% per year). Verifies that expense values increase according to the inflation rate and compound over multiple years.

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

**Description:** Tests expense calculation when an expense item is active for only part of the year (March 1, 2026 to Dec 31, 2027). Verifies that expenses are prorated correctly based on the fraction of the year the item is active.

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

**Description:** Tests dynamic expense that is calculated as a percentage (10%) of income each year, and the expense contributes to an asset (401K account). Verifies that the expense amount recalculates based on the linked income, and the expense contribution adds to the asset balance. Also verifies that the expense drops to $0 when the linked income ends.

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

**Description:** Tests that an expense contributes to an asset balance each year. Verifies that the expense amount (e.g., $10,000) is added to the asset balance annually, accumulating over time.

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

**Description:** Tests a simple fixed liability that does not change over time. Verifies that the liability value remains constant at $50,000 across all years.

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

**Description:** Tests liability calculation with annual growth (3% per year). Verifies that liability values increase according to the growth rate, compounding over multiple years.

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

**Description:** Tests amortized loan calculation using standard amortization formulas. Verifies that the loan balance decreases correctly over time based on principal payments, and that the balance calculation matches expected amortization schedules.

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

**Expected Values:**
- Year 2026: Balance = $98,650.41 (after 12 months of payments)
- Year 2027: Balance = $97,106.00 (after 24 months of payments)
- Year 2028: Balance = $95,482.57 (after 36 months of payments)
- Balance decreases over time
- Final year: Balance = $0

**Note:** Monthly payment is calculated automatically. For a $100,000 loan at 5% for 30 years, monthly payment = $536.82.

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

**Description:** Tests amortized loan when `create_payment_expense` is enabled, which automatically creates an expense item for loan payments. Verifies that the loan balance decreases correctly and that payment expenses are reflected in cash flow calculations.

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

**IMPORTANT:** Before running the tax calculation tests, you must enable "Calculate Federal Income Tax" in **Settings > Applications**. Without this setting enabled, the Federal Income Tax (Calculated) expense will not be automatically created or calculated.

### 5.1 Federal Income Tax (Calculated)

**Description:** Tests automatic federal income tax calculation when `calculate_federal_tax` is enabled in settings. Verifies that tax is calculated based on taxable income using the correct tax brackets and standard deductions for the filing status, and that the tax appears as an expense in projections.

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
- For $100,000 total income (Single, 2026):
  - Standard deduction: $14,950
  - Taxable income: $85,050 ($100,000 - $14,950)
  - Federal tax: $13,625.00
    - First $11,925 at 10% = $1,192.50
    - Next $36,550 at 12% = $4,386.00
    - Next $36,575 at 22% = $8,046.50
    - Total: $13,625.00
- For $100,000 total income (Married Filing Jointly, 2026):
  - Standard deduction: $29,900
  - Taxable income: $70,100 ($100,000 - $29,900)
  - Federal tax: $7,935.00
    - First $23,850 at 10% = $2,385.00
    - Next $46,250 at 12% = $5,550.00
    - Total: $7,935.00

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

**Description:** Tests federal tax calculation when multiple taxable income sources are present. Verifies that all taxable income is summed together and tax is calculated on the total, not on each income source separately.

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

**Description:** Tests federal tax calculation when both taxable and non-taxable income sources are present. Verifies that only taxable income is included in tax calculations, while non-taxable income is excluded from tax computation but still included in total income for cash flow purposes.

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
    "category": "Investments",
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

**Description:** Tests dividend reinvestment where dividends are calculated as a percentage (2%) of the beginning-of-year asset balance and automatically reinvested back into the asset. Verifies that dividends are added to the asset balance after growth is applied, and that dividend income appears correctly when reinvestment is disabled. Note: This test requires UI interaction to enable dividend tracking on the asset.

**Setup:**
```bash
# Create asset (with dividend tracking - income item will be auto-generated by UI)
# Note: The UI automatically creates a dividend income item when "Track Dividends as Taxable Income" 
# is checked at 2%. The auto-generated income item defaults to category "Dividends (qualified)".
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

# In the UI, check "Track Dividends as Taxable Income" at 2%
# This will auto-generate a dividend income item with:
# - Category: "Dividends (qualified)" (default)
# - Percentage: 2.0
# - Reinvest Dividends: true (automatically reinvested back into the asset)
# - Reinvestment Account: The same asset (Test Asset 6.1)

echo "Created Asset ID: $ASSET_6_1_ID"
echo "NOTE: In the UI, enable 'Track Dividends as Taxable Income' at 2% to auto-generate the dividend income item"
```

**Expected Values:**
- Year 2026:
  - Asset beginning balance: $100,000.00
  - Dividend income: $2,000.00 (100,000 * 0.02)
  - Asset growth (5%): $5,000.00 (100,000 * 0.05)
  - Dividend reinvested: $2,000.00
  - Asset end balance: $107,000.00 (100,000 + 5,000 growth + 2,000 dividend)
- Year 2027:
  - Asset beginning balance: $107,000.00 (from previous year)
  - Dividend income: $2,140.00 (107,000 * 0.02)
  - Asset growth (5%): $5,350.00 (107,000 * 0.05)
  - Dividend reinvested: $2,140.00
  - Asset end balance: $114,490.00 (107,000 + 5,350 growth + 2,140 dividend)
- Year 2028 and beyond: Asset continues to grow with dividends reinvested each year

**Verify in:**
- Custom Charts (income and asset)
- Cash Flow Overview
- Balance Sheet Projections

**Cleanup:**
```bash
# Note: If dividend income was auto-generated, find and delete it first
# Get the auto-generated dividend income item ID
INCOME_6_1_ID=$(curl -s -X GET "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" | jq -r ".[] | select(.description | contains(\"Test Asset 6.1\") and contains(\"Dividends\")) | .id")

if [ -n "$INCOME_6_1_ID" ] && [ "$INCOME_6_1_ID" != "null" ]; then
  curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_6_1_ID}" \
    -H "Authorization: Bearer ${TOKEN}"
  echo "Deleted auto-generated Income ID: $INCOME_6_1_ID"
fi

curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_1_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Asset ID: $ASSET_6_1_ID"
```

---

### 6.2 Auto-Disbursements

**Description:** Tests automatic transfers between assets (auto-disbursements) that are applied at the beginning of each year before growth calculations. Verifies that transfers happen before growth so transferred amounts benefit from the same year's growth, and that both source and target assets reflect the transfers correctly.

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
DISBURSEMENT_6_2_ID=$(curl -s -X POST "${API_BASE}/auto-disbursements/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Auto-Disbursement 6.2\",
    \"source_asset_id\": ${ASSET_6_2A_ID},
    \"target_asset_id\": ${ASSET_6_2B_ID},
    \"transfer_type\": \"dollar_amount\",
    \"transfer_value\": 5000,
    \"start_date\": \"2026-01-01\",
    \"end_date\": null
  }" | jq -r '.id')

echo "Created Asset IDs: $ASSET_6_2A_ID, $ASSET_6_2B_ID, Disbursement ID: $DISBURSEMENT_6_2_ID"
```

**Expected Values:**

**Year 2026:**
- Asset 6.2A: $100,000.00 (before transfer) → $95,000.00 (after $5,000 transfer) → $99,750.00 (after 5% growth)
- Asset 6.2B: $0.00 (before transfer) → $5,000.00 (after transfer) → $5,150.00 (after 3% growth)

**Year 2027:**
- Asset 6.2A: $99,750.00 (before transfer) → $94,750.00 (after $5,000 transfer) → $99,488.00 (after 5% growth)
- Asset 6.2B: $5,150.00 (before transfer) → $10,150.00 (after transfer) → $10,455.00 (after 3% growth)

**Year 2028:**
- Asset 6.2A: $99,488.00 (before transfer) → $94,488.00 (after $5,000 transfer) → $99,212.00 (after 5% growth)
- Asset 6.2B: $10,455.00 (before transfer) → $15,455.00 (after transfer) → $15,918.00 (after 3% growth)

**Note:** Auto-disbursements are applied at the beginning of each year (before growth), so transferred amounts benefit from growth in the same year.

**Verify in:**
- Balance Sheet Projections
- Custom Charts (both assets)

**Cleanup:**
```bash
curl -s -X DELETE "${API_BASE}/auto-disbursements/${DISBURSEMENT_6_2_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_2A_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_2B_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Deleted Disbursement ID: $DISBURSEMENT_6_2_ID, Asset IDs: $ASSET_6_2A_ID, $ASSET_6_2B_ID"
```

---

### 6.3 Surplus Asset Transfers

**Description:** Tests surplus/deficit transfers to a designated surplus asset that are applied at the end of each year after growth calculations. Verifies that cash flow surplus/deficit (income minus expenses) is correctly calculated and added to the surplus asset after all assets have grown, representing an end-of-year cash flow transfer.

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

# Set surplus asset in user settings
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"surplus_asset_id\": ${ASSET_6_3_ID}
  }" > /dev/null

echo "Created Income ID: $INCOME_6_3_ID, Expense ID: $EXPENSE_6_3_ID, Asset ID: $ASSET_6_3_ID"
echo "Set surplus asset to Asset ID: $ASSET_6_3_ID"
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
# Reset surplus asset setting
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "surplus_asset_id": null
  }' > /dev/null

curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_6_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/cashflow/${EXPENSE_6_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
curl -s -X DELETE "${API_BASE}/assets/${ASSET_6_3_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
echo "Reset surplus asset and deleted Income ID: $INCOME_6_3_ID, Expense ID: $EXPENSE_6_3_ID, Asset ID: $ASSET_6_3_ID"
```

---

### 6.4 Multiple Linked Items Chain

**Description:** Tests a complex chain of linked items: asset generates income, income generates expense, and expense contributes to another asset. Verifies that all dynamic calculations update correctly in sequence and that changes propagate through the chain properly.

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
    \"category\": \"Investments\",
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

**Year 2026:**
- Asset 6.4: $1,000,000.00 (beginning) → $1,050,000.00 (after 5% growth)
- Income: $40,000.00 (1,000,000 * 0.04, calculated from beginning balance during income processing)
- Expense: $4,200.00 (where expense recalculates income as 1,050,000 * 0.04 = 42,000, then 42,000 * 0.10 = 4,200 - expense uses asset after growth)
- Asset 6.4B: $4,200.00 (from expense contribution, no growth on $0 starting balance)

**Year 2027:**
- Asset 6.4: $1,050,000.00 (beginning) → $1,102,500.00 (after 5% growth)
- Income: $42,000.00 (1,050,000 * 0.04, calculated from beginning balance during income processing)
- Expense: $4,410.00 (where expense recalculates income as 1,102,500 * 0.04 = 44,100, then 44,100 * 0.10 = 4,410 - expense uses asset after growth)
- Asset 6.4B: $4,200.00 (beginning) → $4,326.00 (after 3% growth) → $8,736.00 (after adding $4,410 expense contribution)

**Note:** Income is calculated from the beginning-of-year asset balance during income processing. However, when an expense is linked to income and the linked income is dynamic (linked to an asset), the expense contribution to assets recalculates the income value using the current asset balance (which is after growth has been applied during the loop). This results in the expense amount being slightly higher than the income percentage would suggest, based on the income value displayed in charts.

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

## 7. Comprehensive Integration Test (All Features)

**CSV Results Template:** Use `COMPREHENSIVE_TEST_RESULTS_TEMPLATE.csv` to record expected vs actual values for easy comparison.

**⚠️ Required Categories Before Beginning:**

Before running this test, ensure the following categories exist in your Settings:

**Asset Categories:**
- Investment
- Savings
- Retirement
- Checking

**Liability Categories:**
- Mortgage
- Car Loan

**Income Categories:**
- Salary, Wages, Tips
- Dividends (qualified)
- Rental Income

**Expense Categories:**
- Housing
- Investments
- Utilities

**Profile Settings Required:**

Before running this test, configure the following Social Security settings in Settings → Profile:

- **Person 1:**
  - **Birthdate: REQUIRED** (YYYY-MM-DD format) - Used for FRA calculation
  - Social Security PIA: $4,000
  - Social Security Retirement Date: 8/1/2026 (2026-08-01)

- **Person 2:**
  - **Birthdate: REQUIRED** (YYYY-MM-DD format) - Used for FRA calculation
  - Social Security PIA: $2,000
  - Social Security Retirement Date: 10/1/2026 (2026-10-01)

**⚠️ Important:** Birthdates are **required** for Social Security calculations. The system uses birthdates to:
1. Calculate Full Retirement Age (FRA) based on birth year
2. Determine the actual monthly benefit (which may be adjusted from PIA based on early/late retirement relative to FRA)
3. Create/update Social Security income items automatically

Without birthdates, Social Security calculations will fail. The PIA (Primary Insurance Amount) represents the full retirement benefit; the actual benefit will be calculated based on the retirement date relative to FRA.

**Note:** Social Security income items will be automatically created when these profile settings are configured with valid birthdates, PIA, and retirement dates.

**Note:** If any categories are missing, add them via Settings → Categories before creating the test items. If you add categories after creating items, you may need to refresh the browser for validation warnings to clear.

This test creates a realistic financial scenario that exercises all major features simultaneously:
- Assets with growth and partial years
- Liabilities (amortized loans)
- Income (fixed, dynamic, with partial years)
- Expenses (fixed with inflation, dynamic linked to income, contributing to assets, with partial years)
- **Auto-disbursements** (IRA to Brokerage transfer - $6,500/year, applied at beginning of year before growth)
- **Surplus asset transfers** (Net cash flow surplus/deficit to Comp Test Checking - applied at end of year after growth)
- Tax calculation (Married Filing Jointly)
- Dividend reinvestment (compounded into asset)

**Setup:**
```bash
# ========================================
# COMPREHENSIVE INTEGRATION TEST
# ========================================
echo "Starting Comprehensive Integration Test..."

# Track all created IDs for cleanup
ASSET_IDS=()
INCOME_IDS=()
EXPENSE_IDS=()
LIABILITY_IDS=()
DISBURSEMENT_IDS=()

# --- ASSETS ---
echo "Creating assets..."

# Asset 1: Investment account with growth
ASSET_INV=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comp Test Investment",
    "category": "Investment",
    "value": 200000,
    "annual_increase_percent": 7.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')
ASSET_IDS+=("$ASSET_INV")
echo "Created Investment Asset ID: $ASSET_INV"

# Asset 2: Savings account (for surplus transfers)
ASSET_SAV=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comp Test Savings",
    "category": "Savings",
    "value": 50000,
    "annual_increase_percent": 2.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')
ASSET_IDS+=("$ASSET_SAV")
echo "Created Savings Asset ID: $ASSET_SAV"

# Asset 3: 401K (receives expense contributions)
ASSET_401K=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comp Test 401K",
    "category": "Investment",
    "value": 150000,
    "annual_increase_percent": 6.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')
ASSET_IDS+=("$ASSET_401K")
echo "Created 401K Asset ID: $ASSET_401K"

# Asset 4: IRA (source for auto-disbursement)
ASSET_IRA=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comp Test IRA",
    "category": "Investment",
    "value": 100000,
    "annual_increase_percent": 5.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')
ASSET_IDS+=("$ASSET_IRA")
echo "Created IRA Asset ID: $ASSET_IRA"

# Asset 5: Brokerage (destination for auto-disbursement, receives dividends)
ASSET_BROK=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comp Test Brokerage",
    "category": "Investment",
    "value": 0,
    "annual_increase_percent": 8.0,
    "account_id": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')
ASSET_IDS+=("$ASSET_BROK")
echo "Created Brokerage Asset ID: $ASSET_BROK"

# Asset 6: Checking account (for surplus, starts mid-year)
ASSET_CHK=$(curl -s -X POST "${API_BASE}/assets/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comp Test Checking",
    "category": "Checking",
    "value": 10000,
    "annual_increase_percent": 0.0,
    "account_id": null,
    "start_date": "2026-07-01",
    "end_date": null
  }' | jq -r '.id')
ASSET_IDS+=("$ASSET_CHK")
echo "Created Checking Asset ID: $ASSET_CHK"

# --- LIABILITIES ---
echo "Creating liabilities..."

# Liability 1: Amortized mortgage (30-year loan)
LIABILITY_MORT=$(curl -s -X POST "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comp Test Mortgage",
    "category": "Mortgage",
    "value": null,
    "annual_increase_percent": null,
    "loan_type": "amortized",
    "principal_amount": 250000,
    "interest_rate": 4.0,
    "loan_term_months": 360,
    "loan_start_date": "2025-01-01",
    "monthly_payment": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')
LIABILITY_IDS+=("$LIABILITY_MORT")
echo "Created Mortgage Liability ID: $LIABILITY_MORT"

# Liability 2: Amortized car loan
LIABILITY_CAR=$(curl -s -X POST "${API_BASE}/liabilities/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Comp Test Car Loan",
    "category": "Car Loan",
    "value": null,
    "annual_increase_percent": null,
    "loan_type": "amortized",
    "principal_amount": 30000,
    "interest_rate": 4.5,
    "loan_term_months": 60,
    "loan_start_date": "2025-06-01",
    "monthly_payment": null,
    "start_date": null,
    "end_date": null
  }' | jq -r '.id')
LIABILITY_IDS+=("$LIABILITY_CAR")
echo "Created Car Loan Liability ID: $LIABILITY_CAR"

# --- INCOME ---
echo "Creating income items..."

# Income 1: Fixed salary with growth
INCOME_SAL=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Comp Test Salary",
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
INCOME_IDS+=("$INCOME_SAL")
echo "Created Salary Income ID: $INCOME_SAL"

# Income 2: Dynamic income linked to investment (dividends, reinvested via UI)
# NOTE: For this test, we'll create it manually. In practice, enable "Track Dividends as Taxable Income"
# on Comp Test Investment asset in the UI to auto-generate this.
INCOME_DIV=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": true,
    \"category\": \"Dividends (qualified)\",
    \"description\": \"Comp Test Investment Dividends\",
    \"frequency\": \"yearly\",
    \"value\": 0,
    \"annual_increase_percent\": 0,
    \"start_date\": null,
    \"end_date\": null,
    \"taxable\": true,
    \"linked_item_id\": ${ASSET_INV},
    \"linked_item_type\": \"asset\",
    \"percentage\": 2.0,
    \"person\": \"Family\",
    \"reinvest_dividends\": true,
    \"reinvestment_account_id\": ${ASSET_INV}
  }" | jq -r '.id')
INCOME_IDS+=("$INCOME_DIV")
echo "Created Dividend Income ID: $INCOME_DIV"

# Income 3: Rental income with partial year (starts mid-year)
INCOME_RENT=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Rental Income",
    "description": "Comp Test Rental Income",
    "frequency": "yearly",
    "value": 24000,
    "annual_increase_percent": 2.0,
    "start_date": "2026-07-01",
    "end_date": null,
    "taxable": true,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')
INCOME_IDS+=("$INCOME_RENT")
echo "Created Rental Income ID: $INCOME_RENT"

# --- EXPENSES ---
echo "Creating expense items..."

# Expense 1: Fixed housing expense with inflation
EXPENSE_HOUSING=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Housing",
    "description": "Comp Test Housing",
    "frequency": "yearly",
    "value": 36000,
    "inflation_percent": 3.0,
    "start_date": null,
    "end_date": null,
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')
EXPENSE_IDS+=("$EXPENSE_HOUSING")
echo "Created Housing Expense ID: $EXPENSE_HOUSING"

# Expense 2: Dynamic expense linked to income (401K contribution - 10% of salary)
EXPENSE_401K=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"is_income\": false,
    \"category\": \"Investments\",
    \"description\": \"Comp Test 401K Contribution\",
    \"frequency\": \"yearly\",
    \"value\": 0,
    \"inflation_percent\": 0,
    \"start_date\": null,
    \"end_date\": null,
    \"tax_deductible\": true,
    \"linked_item_id\": ${INCOME_SAL},
    \"linked_item_type\": \"income\",
    \"percentage\": 10.0,
    \"person\": \"Family\",
    \"contributes_to_asset_id\": ${ASSET_401K}
  }" | jq -r '.id')
EXPENSE_IDS+=("$EXPENSE_401K")
echo "Created 401K Contribution Expense ID: $EXPENSE_401K"

# Expense 3: Fixed expense with partial year (ends mid-year)
EXPENSE_UTIL=$(curl -s -X POST "${API_BASE}/cashflow?is_income=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": false,
    "category": "Utilities",
    "description": "Comp Test Utilities",
    "frequency": "yearly",
    "value": 6000,
    "inflation_percent": 2.0,
    "start_date": null,
    "end_date": "2027-06-30",
    "tax_deductible": false,
    "linked_item_id": null,
    "linked_item_type": null,
    "percentage": null,
    "person": "Family"
  }' | jq -r '.id')
EXPENSE_IDS+=("$EXPENSE_UTIL")
echo "Created Utilities Expense ID: $EXPENSE_UTIL"

# --- AUTO-DISBURSEMENTS ---
echo "Creating auto-disbursements..."

DISBURSEMENT_IRA=$(curl -s -X POST "${API_BASE}/auto-disbursements/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Comp Test IRA to Brokerage\",
    \"source_asset_id\": ${ASSET_IRA},
    \"target_asset_id\": ${ASSET_BROK},
    \"transfer_type\": \"dollar_amount\",
    \"transfer_value\": 6500,
    \"start_date\": \"2026-01-01\",
    \"end_date\": null
  }" | jq -r '.id')
DISBURSEMENT_IDS+=("$DISBURSEMENT_IRA")
echo "Created Auto-Disbursement ID: $DISBURSEMENT_IRA"

# --- SET SURPLUS ASSET ---
echo "Setting surplus asset..."
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"surplus_asset_id\": ${ASSET_CHK}
  }" > /dev/null
echo "Set surplus asset to Checking account"

# --- SET SOCIAL SECURITY PROFILE ---
echo "Setting Social Security profile settings..."
# NOTE: Birthdates are REQUIRED for Social Security calculations (FRA determination)
# Update the birthdates below based on your desired Full Retirement Age (FRA)
# Example: If FRA is 67, birthdate for Person 1 retiring 8/1/2026 would be around 1959-08-01
# Example: If FRA is 67, birthdate for Person 2 retiring 10/1/2026 would be around 1959-10-01
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "person1_birthdate": "1959-08-01",
    "person1_ss_pia": 4000,
    "person1_ss_retirement_date": "2026-08-01",
    "person2_birthdate": "1959-10-01",
    "person2_ss_pia": 2000,
    "person2_ss_retirement_date": "2026-10-01"
  }' > /dev/null
echo "Set Social Security profile (Person 1: Birthdate 1959-08-01, PIA $4,000, Retirement 8/1/2026; Person 2: Birthdate 1959-10-01, PIA $2,000, Retirement 10/1/2026)"

# --- ENABLE TAX CALCULATION (if desired) ---
echo "Enabling federal tax calculation..."
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": true,
    "tax_filing_status": "Married Filing Jointly"
  }' > /dev/null
echo "Enabled federal tax calculation"

echo ""
echo "========================================="
echo "Comprehensive Integration Test Setup Complete!"
echo "========================================="
echo ""
echo "Created:"
echo "  - Assets: ${#ASSET_IDS[@]}"
echo "  - Liabilities: ${#LIABILITY_IDS[@]}"
echo "  - Income Items: ${#INCOME_IDS[@]}"
echo "  - Expense Items: ${#EXPENSE_IDS[@]}"
echo "  - Auto-Disbursements: ${#DISBURSEMENT_IDS[@]}"
echo ""
```

**Expected Values (Year 2026 - First Full Year):**

**Summary Table:**

| Category | Item | Year 2026 | Notes |
|----------|------|-----------|-------|
| **Assets** | Comp Test Investment | $218,000.00 | Beginning: $200k, Growth: $14k, Dividends: $4k |
| | Comp Test Savings | $51,000.00 | 50k * 1.02 growth |
| | Comp Test 401K | $169,000.00 | Beginning: $150k, Growth: $9k, Contribution: $10k |
| | Comp Test IRA | $98,500.00 | Beginning: $100k, Growth: $5k, Transfer: -$6.5k |
| | Comp Test Brokerage | $7,020.00 | Beginning: $0, Transfer: +$6.5k, Growth: $520 |
| | Comp Test Checking | $10,000.00 | Beginning: $10k, Surplus applied at end of year (starts 7/1/2026 - check surplus calculation) |
| **Liabilities** | Comp Test Mortgage | Amortized (~$248k) | Amortized 30-year loan, 4% interest (not fixed) |
| | Comp Test Car Loan | ~$24,500.00 | Amortized 60-month loan, 4.5% interest (started 6/1/2025) |
| **Income** | Comp Test Salary | $100,000.00 | Year 1 (no growth yet) |
| | Comp Test Investment Dividends | $4,000.00 | 2% of $200k beginning, reinvested |
| | Comp Test Rental Income | ~$12,000.00 | 24k * 0.5 (partial year from 7/1/2026) |
| | Social Security - Person 1 | ~$20,000.00 | ~$4k/month * 5 months (starts 8/1/2026, partial year) |
| | Social Security - Person 2 | ~$6,000.00 | ~$2k/month * 3 months (starts 10/1/2026, partial year) |
| | **Total Income** | **~$142,000.00** | |
| **Expenses** | Comp Test Housing | $36,000.00 | Base value (inflation starts in year 2) |
| | Comp Test 401K Contribution | $10,000.00 | 10% of $100k salary |
| | Comp Test Utilities | $6,000.00 | Base value (inflation starts in year 2) |
| | Federal Income Tax (MFJ) | ~$7,935.00 | Married Filing Jointly (see 7.1 for details) |
| | **Total Expenses (excluding tax)** | **~$52,000.00** | |
| **Cash Flow** | **Surplus/Deficit** | **~$82,065.00** | ~142k income - 52k expenses - 7.935k tax = ~$82,065 |

**Important Notes:**

1. **Inflation Timing:** Inflation/growth is applied starting in year 2. Year 1 uses the base value without inflation (growth_factor = pow(1 + rate, year - 1), so year 1 = base value, year 2 = base * (1 + rate), year 3 = base * (1 + rate)^2).

2. **Auto-Disbursements:** IRA to Brokerage transfer ($6,500/year) is applied at the **beginning of each year** before asset growth, so transferred amounts benefit from growth in the same year.

3. **Surplus Transfers:** Net cash flow surplus/deficit to Comp Test Checking is applied at the **end of each year** after asset growth. For assets with partial year start dates (like Comp Test Checking starting 7/1/2026), surplus is calculated for the entire year but the asset must be active to receive it.

4. **Utilities Category Warning:** If you add the "Utilities" category after creating the expense, you may need to refresh the browser for the warning to clear. This is expected behavior - category validation happens on page load, not dynamically.

5. **Federal Income Tax in Refresh Itemization:** The Federal Income Tax (Calculated) expense is auto-generated by the system when `calculate_federal_tax` is enabled. It may not appear when using "Refresh Itemization" because it's not in the regular expense items list - this is expected. It will appear in charts and projections after recalculating.

6. **Tax Calculation:** Ensure `tax_filing_status` is set to "Married Filing Jointly" (not "Single") for the expected tax amounts.

**Note on Inflation:** Inflation is applied starting in year 2 (growth_factor = pow(1 + rate, year - 1), so year 1 uses base value, year 2 applies first inflation).

**Note on Auto-Disbursements and Surplus Transfers:** Auto-disbursements and surplus asset transfers are included in this comprehensive test:
- Auto-Disbursement: IRA to Brokerage transfer ($6,500/year, applied at beginning of year before growth)
- Surplus Transfer: Net cash flow surplus/deficit to Comp Test Checking (applied at end of year after growth)

**Detailed Asset Breakdown:**

| Asset | Beginning Balance | Growth Amount | Other Contributions | Ending Balance |
|-------|------------------|---------------|-------------------|----------------|
| Comp Test Investment | $200,000.00 | $14,000.00 (7%) | +$4,000.00 (dividend reinvested) | $218,000.00 |
| Comp Test Savings | $50,000.00 | $1,000.00 (2%) | - | $51,000.00 |
| Comp Test 401K | $150,000.00 | $9,000.00 (6%) | +$10,000.00 (contribution) | $169,000.00 |
| Comp Test IRA | $100,000.00 | $5,000.00 (5%) | -$6,500.00 (auto-disbursement) | $98,500.00 |
| Comp Test Brokerage | $0.00 | $520.00 (8%) | +$6,500.00 (auto-disbursement) | $7,020.00 |
| Comp Test Checking | $10,000.00 | $0.00 | +Surplus (applied at end of year, may be prorated for partial year) | ~$10k+ (check actual surplus calculation) |

**Detailed Income Breakdown:**

| Income Source | Amount | Notes |
|--------------|--------|-------|
| Comp Test Salary | $100,000.00 | Fixed yearly, Year 1 |
| Comp Test Investment Dividends | $4,000.00 | 2% of $200k beginning balance, reinvested |
| Comp Test Rental Income | ~$12,000.00 | 24k * 0.5 (6 months from 7/1/2026) |
| Social Security - Person 1 | ~$20,000.00 | ~$4k/month * 5 months (starts 8/1/2026, partial year - actual amount depends on FRA calculation) |
| Social Security - Person 2 | ~$6,000.00 | ~$2k/month * 3 months (starts 10/1/2026, partial year - actual amount depends on FRA calculation) |
| **Total Income** | **~$142,000.00** | |

**Detailed Expense Breakdown:**

| Expense | Amount | Notes |
|---------|--------|-------|
| Comp Test Housing | $36,000.00 | Base value (inflation starts in year 2: $36k * 1.03 = $37,080 in year 2) |
| Comp Test 401K Contribution | $10,000.00 | 10% of $100k salary, tax-deductible |
| Comp Test Utilities | $6,000.00 | Base value (inflation starts in year 2: $6k * 1.02 = $6,120 in year 2) |
| Federal Income Tax (Calculated) | ~$7,935.00 | Married Filing Jointly (see section 7.1 for Single comparison) |
| **Total Expenses (excluding tax)** | **~$52,000.00** | |

**Cash Flow Analysis:**

| Item | Amount |
|------|--------|
| Total Income | ~$142,000.00 |
| Total Expenses (excluding tax) | -$52,000.00 |
| Federal Income Tax | -$7,935.00 |
| **Net Cash Flow (Surplus)** | **~$82,065.00** | ~142k - 52k - 7.935k |

**Expected Values (Year 2027):**

**Summary Table:**

| Category | Item | Year 2027 | Notes |
|----------|------|-----------|-------|
| **Assets** | Comp Test Investment | ~$236,000.00 | 218k * 1.07 + ~$4.4k dividend |
| | Comp Test Savings | $52,020.00 | 51k * 1.02 |
| | Comp Test 401K | ~$189,140.00 | 169k * 1.06 + ~$10.6k contribution |
| | Comp Test IRA | ~$97,425.00 | 98.5k * 1.05 - $6.5k transfer |
| | Comp Test Brokerage | ~$14,141.00 | 7.02k * 1.08 + $6.5k transfer |
| | Comp Test Checking | Accumulating | Surplus continues |
| **Liabilities** | Comp Test Mortgage | $250,000.00 | Fixed |
| | Comp Test Car Loan | ~$20,500.00 | Amortizing |
| **Income** | Comp Test Salary | $103,000.00 | 100k * 1.03 (3% growth) |
| | Comp Test Investment Dividends | ~$4,400.00 | 2% of beginning balance |
| | Comp Test Rental Income | $12,240.00 | 24k * 1.02 * 1.0 (full year) |
| | Social Security - Person 1 | ~$48,000.00 | ~$4k/month * 12 months (full year starting from 8/1/2026) |
| | Social Security - Person 2 | ~$24,000.00 | ~$2k/month * 12 months (full year starting from 10/1/2026) |
| | **Total Income** | **~$191,640.00** | |
| **Expenses** | Comp Test Housing | ~$38,192.00 | 37.08k * 1.03 |
| | Comp Test 401K Contribution | ~$10,300.00 | 10% of $103k salary |
| | Comp Test Utilities | $0.00 | Ended 6/30/2027 |
| | Federal Income Tax (MFJ) | ~$8,151.00 | Based on year 2 taxable income (includes Social Security) |
| **Cash Flow** | **Surplus/Deficit** | **~$136,109.00** | ~191.64k income - 47.38k expenses - 8.151k tax |

**Expected Values (Year 2028):**

**Summary Table:**

| Category | Item | Year 2028 | Notes |
|----------|------|-----------|-------|
| **Assets** | Comp Test Investment | ~$256,000.00+ | Continues growing with dividends |
| | Comp Test Checking | Accumulated | Surplus from previous years |
| | Other Assets | Growing | All assets continue to grow |
| **Liabilities** | Comp Test Car Loan | ~$16,500.00 | Continues amortizing toward $0 |
| | Comp Test Mortgage | $250,000.00 | Fixed |

**Year-by-Year Asset Growth Comparison:**

| Asset | 2026 | 2027 | 2028 | Growth Rate |
|-------|------|------|------|-------------|
| Comp Test Investment | $218,000 | ~$236,000 | ~$256,000 | 7% + dividends |
| Comp Test Savings | $51,000 | $52,020 | ~$53,060 | 2% |
| Comp Test 401K | $169,000 | ~$189,140 | ~$210,488 | 6% + contributions |
| Comp Test IRA | $98,500 | ~$97,425 | ~$95,843 | 5% - transfers |
| Comp Test Brokerage | $7,020 | ~$14,141 | ~$21,672 | 8% + transfers |
| Comp Test Checking | ~$72,860 | Accumulating | Accumulating | 0% + surplus |

### 7.1 Tax Calculation Comparison (Test 5.1)

**Description:** This test compares federal income tax calculations for Single vs. Married Filing Jointly filing statuses. It verifies that tax brackets, standard deductions, and tax calculations are correct for both filing statuses using the same income scenario.

**Setup:**
```bash
# Create income for tax calculation test
INCOME_TAX_TEST_ID=$(curl -s -X POST "${API_BASE}/cashflow?is_income=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_income": true,
    "category": "Salary, Wages, Tips",
    "description": "Tax Test Income",
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

echo "Created Tax Test Income ID: $INCOME_TAX_TEST_ID"

# Test 1: Single Filing Status
echo "Testing Single filing status..."
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": true,
    "tax_filing_status": "Single"
  }' > /dev/null
echo "Enabled federal tax calculation (Single)"

# Test 2: Married Filing Jointly Filing Status
echo "Testing Married Filing Jointly filing status..."
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": true,
    "tax_filing_status": "Married Filing Jointly"
  }' > /dev/null
echo "Enabled federal tax calculation (Married Filing Jointly)"
```

**Expected Values - Tabular Comparison:**

For $100,000 total taxable income (2026 tax year):

| Filing Status | Standard Deduction | Taxable Income | Tax Calculation | Federal Tax |
|---------------|-------------------|----------------|-----------------|-------------|
| **Single** | $14,950 | $85,050 | First $11,925 @ 10% = $1,192.50<br>Next $36,550 @ 12% = $4,386.00<br>Next $36,575 @ 22% = $8,046.50 | **$13,625.00** |
| **Married Filing Jointly** | $29,900 | $70,100 | First $23,850 @ 10% = $2,385.00<br>Next $46,250 @ 12% = $5,550.00 | **$7,935.00** |

**Tax Comparison Chart:**

```
Federal Income Tax Comparison
$100,000 Total Income (2026)

Single Filing Status:
Total Income:    $100,000.00
Deduction:       -$ 14,950.00
Taxable Income:  $ 85,050.00
─────────────────────────────
Tax Breakdown:
  10% bracket:   $  1,192.50  (on $11,925)
  12% bracket:   $  4,386.00  (on $36,550)
  22% bracket:   $  8,046.50  (on $36,575)
─────────────────────────────
Total Tax:       $ 13,625.00
Effective Rate:  13.6%

Married Filing Jointly:
Total Income:    $100,000.00
Deduction:       -$ 29,900.00
Taxable Income:  $ 70,100.00
─────────────────────────────
Tax Breakdown:
  10% bracket:   $  2,385.00  (on $23,850)
  12% bracket:   $  5,550.00  (on $46,250)
─────────────────────────────
Total Tax:       $  7,935.00
Effective Rate:   7.9%

Tax Savings (MFJ vs Single): $5,690.00 (41.8% reduction)
```

**Year-by-Year Comparison Table:**

| Year | Income | Single Status Tax | MFJ Status Tax | Difference | Savings % |
|------|--------|------------------|----------------|------------|-----------|
| 2026 | $100,000 | $13,625.00 | $7,935.00 | -$5,690.00 | 41.8% |
| 2027 | $100,000 | $13,625.00 | $7,935.00 | -$5,690.00 | 41.8% |
| 2028 | $100,000 | $13,625.00 | $7,935.00 | -$5,690.00 | 41.8% |

**Visual Tax Bracket Comparison:**

```
Tax Brackets (2026) - Single vs Married Filing Jointly

Single Filing Status Brackets:
┌─────────────────┬──────────┬──────────────┐
│ Taxable Income  │ Rate     │ Max Tax      │
├─────────────────┼──────────┼──────────────┤
│ $0 - $11,925    │ 10%      │ $1,192.50    │
│ $11,925 - $47,150│ 12%     │ $5,578.50    │
│ $47,150 - $100,525│ 22%    │ $15,532.50   │
│ $100,525 - $191,950│ 24%   │ $37,300.50   │
└─────────────────┴──────────┴──────────────┘

Married Filing Jointly Brackets:
┌─────────────────┬──────────┬──────────────┐
│ Taxable Income  │ Rate     │ Max Tax      │
├─────────────────┼──────────┼──────────────┤
│ $0 - $23,850    │ 10%      │ $2,385.00    │
│ $23,850 - $94,300│ 12%     │ $11,166.00   │
│ $94,300 - $201,050│ 22%    │ $31,106.00   │
│ $201,050 - $383,900│ 24%   │ $75,098.00   │
└─────────────────┴──────────┴──────────────┘

Key Differences:
• MFJ standard deduction is 2x Single ($29,900 vs $14,950)
• MFJ bracket thresholds are ~2x Single (but not exactly double)
• MFJ provides tax savings, especially at lower income levels
```

**Tax Visualization:**

```
Tax Amount Comparison ($100k Income)
═══════════════════════════════════════════════════════════════
$14,000 │                                          ┌────────┐
        │                                          │        │
$12,000 │                                          │ Single │
        │                                          │ $13,625│
$10,000 │                                          │        │
        │                          ┌───────────────┘        │
 $8,000 │                          │                         │
        │                          │ MFJ                    │
 $6,000 │                          │ $7,935                 │
        │                          │                         │
 $4,000 │                          │                         │
        │                          │                         │
 $2,000 │                          │                         │
        │                          │                         │
     $0 └──────────────────────────┴─────────────────────────
              Single                  Married Filing Jointly
```

**Verify in:**
- Cash Flow Overview (expense category "Taxes")
- Custom Charts (create chart comparing "Federal Income Tax (Calculated)" for both filing statuses)
- BASE Model (verify tax impacts net cash flow)
- Compare results by running projections with each filing status

**Cleanup:**
```bash
# Disable federal tax calculation
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calculate_federal_tax": false
  }' > /dev/null

# Delete tax test income
curl -s -X DELETE "${API_BASE}/cashflow/${INCOME_TAX_TEST_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

echo "Deleted Tax Test Income ID: $INCOME_TAX_TEST_ID"
echo "Disabled federal tax calculation"
```

**Verify in (Comprehensive Integration Test):**
- Custom Charts (all asset, liability, income, and expense series)
- Balance Sheet Projections (verify asset and liability totals)
- Cash Flow Overview (verify income, expenses, and surplus/deficit)
- BASE Model (verify surplus transfers to Checking)
- Monte Carlo Projections (verify random variation)

**Cleanup (Comprehensive Integration Test):**
```bash
# Reset surplus asset and tax settings
curl -s -X PUT "${API_BASE}/settings/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "surplus_asset_id": null,
    "calculate_federal_tax": false
  }' > /dev/null

# Delete auto-disbursements
for id in "${DISBURSEMENT_IDS[@]}"; do
  curl -s -X DELETE "${API_BASE}/auto-disbursements/${id}" \
    -H "Authorization: Bearer ${TOKEN}"
done

# Delete expenses
for id in "${EXPENSE_IDS[@]}"; do
  curl -s -X DELETE "${API_BASE}/cashflow/${id}" \
    -H "Authorization: Bearer ${TOKEN}"
done

# Delete income items
for id in "${INCOME_IDS[@]}"; do
  curl -s -X DELETE "${API_BASE}/cashflow/${id}" \
    -H "Authorization: Bearer ${TOKEN}"
done

# Delete liabilities
for id in "${LIABILITY_IDS[@]}"; do
  curl -s -X DELETE "${API_BASE}/liabilities/${id}" \
    -H "Authorization: Bearer ${TOKEN}"
done

# Delete assets
for id in "${ASSET_IDS[@]}"; do
  curl -s -X DELETE "${API_BASE}/assets/${id}" \
    -H "Authorization: Bearer ${TOKEN}"
done

echo "Cleanup complete!"
```

---

## 8. Edge Cases

### 7.1 Zero Values

**Description:** Tests edge case where assets, income, and expenses have zero values. Verifies that the system handles zero values gracefully without division by zero errors, and that charts and calculations render correctly with zero values.

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

**Description:** Tests assets with negative growth rates (e.g., -5% per year). Verifies that assets decrease correctly over time when growth rates are negative, representing depreciating assets or investments with losses.

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

**Description:** Tests assets with very high growth rates (e.g., 100% per year) to verify that the system handles extreme growth values correctly and that calculations remain accurate even with high growth percentages.

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

**Description:** Tests income items with overlapping date ranges to verify that the system correctly handles items that are active simultaneously and that calculations account for all active items correctly.

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

## 9. Chart-Specific Tests

### 8.1 Custom Chart - All Items vs Specific Item

**Description:** Tests custom chart creation with "All Items" aggregation versus a specific item selection. Verifies that charts correctly display aggregated data for a category versus individual item data, and that both chart types render correctly.

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

**Description:** Tests that custom charts correctly update when the labels or descriptions of underlying items change. Verifies that chart data remains correctly linked to items even after item descriptions are modified.

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

**Description:** Tests that custom charts recalculate correctly when underlying data changes (e.g., income values are updated). Verifies that charts reflect the latest data after recalculations and that chart data stays synchronized with item values.

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
| Auto-Disbursements | `POST /auto-disbursements/` | `GET /auto-disbursements/` | `GET /auto-disbursements/{id}` | `PUT /auto-disbursements/{id}` | `DELETE /auto-disbursements/{id}` |

---

**End of Testing Plan**

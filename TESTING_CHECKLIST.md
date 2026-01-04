# Testing Checklist for New Features

## Pre-Deployment Checklist
- [ ] All files committed to git repository
- [ ] Database migration applied (`alembic upgrade head`)
- [ ] Backend service builds successfully
- [ ] Frontend builds successfully
- [ ] No linter errors in critical files

---

## 1. Accounts Management

### 1.1 Navigation & Access
- [ ] Navigate to Settings > Accounts
- [ ] Page loads without errors
- [ ] "Cancel" button appears and navigates to home when clicked

### 1.2 Create Account
- [ ] Enter Broker (e.g., "Merrill Lynch")
- [ ] Enter Account Name (e.g., "Investment Account")
- [ ] Enter Account Number (optional field)
- [ ] Select "Yes" for Retirement account
- [ ] Click "Add Account"
- [ ] Account appears in the "Existing Accounts" table
- [ ] Try creating account with only Broker and Account Name (required fields)
- [ ] Try creating account without required fields - should show error message

### 1.3 View Accounts
- [ ] Table displays all accounts with columns: Broker, Account Name, Account Number, Retirement, Actions
- [ ] Accounts are listed in correct order
- [ ] Retirement status shows "Yes" or "No"

### 1.4 Edit Account
- [ ] Click "Edit" on an existing account
- [ ] Fields become editable in table row
- [ ] Modify Broker, Account Name, Account Number, or Retirement status
- [ ] Click "Save" - account updates successfully
- [ ] Click "Cancel" - changes are discarded, edit mode exits
- [ ] Try saving with empty required fields - should show error

### 1.5 Delete Account
- [ ] Click "Delete" on an account
- [ ] Confirmation dialog appears: "Are you sure you want to delete this account? Assets linked to this account will have their account link removed."
- [ ] Confirm deletion - account is removed from table
- [ ] Cancel deletion - account remains

---

## 2. Asset-Account Linking

### 2.1 Link Asset to Account
- [ ] Navigate to Assets list
- [ ] Click "Add Asset" or edit an existing asset
- [ ] Verify "Account" dropdown appears in the form
- [ ] Select an account from the dropdown (e.g., "Merrill Lynch - Investment Account")
- [ ] Save the asset
- [ ] Asset is now linked to the selected account

### 2.2 View Linked Assets
- [ ] Edit an asset that has an account linked
- [ ] Verify the Account dropdown shows the correct selected account
- [ ] Change the account to a different one
- [ ] Save - asset is now linked to the new account

### 2.3 Remove Account Link
- [ ] Edit an asset with an account linked
- [ ] Change Account dropdown to "None" or empty
- [ ] Save - account link is removed

---

## 3. Cash Flow Surplus/Deficit Handling

### 3.1 Set Surplus Asset (Profile Settings)
- [ ] **NOTE**: The surplus asset dropdown may need to be added to Profile Settings page
- [ ] Navigate to Settings > Profile
- [ ] Look for "Surplus Asset" dropdown (if implemented)
- [ ] Select an asset account (e.g., "Checking Account") to receive surplus/deficit
- [ ] Save profile settings

### 3.2 Test Surplus Scenario
- [ ] Create Income item: $100,000/year
- [ ] Create Expense items totaling: $90,000/year
- [ ] Net cash flow = $10,000 surplus
- [ ] Create a custom chart showing the surplus asset
- [ ] Run projection for 2-3 years
- [ ] Verify surplus asset increases by $10,000 each year
- [ ] Year 2: Surplus asset should show initial value + $10,000
- [ ] Year 3: Surplus asset should show Year 2 value + $10,000

### 3.3 Test Deficit Scenario
- [ ] Modify expenses to total $110,000/year
- [ ] Net cash flow = -$10,000 deficit
- [ ] Run projection for 2-3 years
- [ ] Verify surplus asset decreases by $10,000 each year
- [ ] Year 2: Surplus asset should show initial value - $10,000
- [ ] Year 3: Surplus asset should show Year 2 value - $10,000

---

## 4. Retirement Account Rules

### 4.1 Retirement Account Setup
- [ ] Create Account with Retirement = "Yes"
- [ ] Create Asset (e.g., "IRA Investment") linked to this retirement account
- [ ] Set asset with dividend/interest income (e.g., 5% growth rate)

### 4.2 Retirement Account Behavior
- [ ] Create Income item that is dynamic (e.g., "Dividends" = 5% of "IRA Investment")
- [ ] Run projection
- [ ] Verify dividends/interest from retirement account:
  - [ ] Are added back to the retirement account balance
  - [ ] Are NOT counted as "available for spending" (do not increase surplus asset)
  - [ ] Do not contribute to positive cash flow

### 4.3 Non-Retirement Account Behavior
- [ ] Create Account with Retirement = "No"
- [ ] Create Asset (e.g., "Brokerage Investment") linked to this account
- [ ] Set asset with dividend/interest income (e.g., 5% growth rate)
- [ ] Create Income item that is dynamic (e.g., "Dividends" = 5% of "Brokerage Investment")
- [ ] Run projection
- [ ] Verify dividends/interest from non-retirement account:
  - [ ] Contribute to available cash flow (can increase surplus asset)
  - [ ] Are available for spending

---

## 5. Auto-Disbursements

### 5.1 Create Auto-Disbursement (Backend API)
- [ ] Use API or UI (if implemented) to create auto-disbursement:
  - Name: "Salary to Savings"
  - Source Asset: Income-generating asset or salary-linked asset
  - Target Asset: Savings Account
  - Transfer Type: "percentage" or "dollar_amount"
  - Transfer Value: 5% or $5,000
  - Start Date: "2026-01-01"
  - End Date: "2030-12-31"

### 5.2 Test Percentage Transfer
- [ ] Create auto-disbursement: 5% of source asset
- [ ] Source asset value: $100,000
- [ ] Expected transfer: $5,000/year
- [ ] Run projection for multiple years
- [ ] Verify target asset increases by $5,000 each year
- [ ] Verify source asset decreases by $5,000 each year (or appropriate amount)

### 5.3 Test Dollar Amount Transfer
- [ ] Create auto-disbursement: $5,000 fixed amount
- [ ] Run projection
- [ ] Verify target asset increases by exactly $5,000 each year
- [ ] Verify source asset decreases by $5,000 each year

### 5.4 Test Start/End Dates
- [ ] Create auto-disbursement with Start Date = Year 2
- [ ] Run projection for 3 years
- [ ] Verify transfer does NOT occur in Year 1
- [ ] Verify transfer occurs in Year 2 and Year 3

- [ ] Create auto-disbursement with End Date = Year 2
- [ ] Run projection for 3 years
- [ ] Verify transfer occurs in Year 1 and Year 2
- [ ] Verify transfer does NOT occur in Year 3

---

## 6. Enhanced Amortized Liability Calculations

### 6.1 Create Amortized Loan
- [ ] Navigate to Liabilities
- [ ] Click "Add Liability"
- [ ] Enter liability details:
  - Name: "Home Mortgage"
  - Loan Type: Select "Amortized Loan" (should work correctly now)
  - Principal Amount: $300,000
  - Interest Rate: 5%
  - Loan Term: 360 months (30 years)
  - Loan Start Date: Past or current date
- [ ] Save successfully (no "Network Error")

### 6.2 Verify Loan Calculations
- [ ] After saving, verify monthly payment is calculated and displayed
- [ ] Edit the loan to view all fields are populated correctly

### 6.3 Test Principal and Interest Breakdown
- [ ] Create custom chart showing the amortized loan
- [ ] Run projection
- [ ] Verify projection data includes:
  - [ ] `principal_paid` for each year
  - [ ] `interest_paid` for each year
  - [ ] Principal and interest amounts are reasonable (principal increases, interest decreases over time)

### 6.4 Test "Decrease Liability by Principal Yearly"
- [ ] Edit amortized loan
- [ ] Check "Decrease liability by principal amount each year"
- [ ] Save
- [ ] Run projection
- [ ] Verify liability balance decreases by principal amount each year
- [ ] Year 1: Initial balance - principal paid Year 1
- [ ] Year 2: Year 1 balance - principal paid Year 2

### 6.5 Test "Create Payment Expense"
- [ ] Edit amortized loan
- [ ] Check "Create corresponding expense for payment amount"
- [ ] Save
- [ ] Run projection
- [ ] Verify an expense is automatically created for the monthly payment amount * 12
- [ ] This expense should appear in expenses list or cash flow calculations

---

## 7. Custom Charts with Account Filtering

### 7.1 Account Multi-Selector
- [ ] Navigate to Custom Charts
- [ ] Click "Create New Chart" or edit existing chart
- [ ] Add a new series
- [ ] Select Data Type: "Assets"
- [ ] Verify "Account" multi-selector appears
- [ ] Select multiple accounts (e.g., "Merrill Lynch" and "Fidelity")
- [ ] Save chart

### 7.2 Test Account Filtering
- [ ] Create chart with Assets filtered by specific accounts
- [ ] Run projection/view chart
- [ ] Verify only assets linked to selected accounts are included
- [ ] Assets not linked to selected accounts should be excluded

### 7.3 Test Without Account Filter
- [ ] Create chart with Assets data type but no accounts selected
- [ ] Verify all assets are included in the projection

---

## 8. Monte Carlo Projections

### 8.1 Access Monte Carlo
- [ ] Navigate to Sidebar
- [ ] Under "Cash Flow Projections", click "Monte Carlo Projections"
- [ ] Page loads (currently placeholder)

### 8.2 Verify Navigation
- [ ] Monte Carlo link appears in correct section
- [ ] Link is functional (no 404 errors)

---

## 9. Sidebar Navigation Updates

### 9.1 Section Names
- [ ] Verify "Items Management" is renamed to "Net Worth"
- [ ] Verify section contains: Assets, Liabilities

### 9.2 New Cash Flow Section
- [ ] Verify new "Cash Flow" section exists
- [ ] Verify "Income" is in Cash Flow section
- [ ] Verify "Expenses" is in Cash Flow section
- [ ] Verify items are no longer in Net Worth section

---

## 10. Integration Testing

### 10.1 Complete Retirement Scenario
- [ ] Create retirement account (IRA)
- [ ] Create non-retirement account (Brokerage)
- [ ] Link assets to respective accounts
- [ ] Set up income/expenses with surplus
- [ ] Set surplus asset
- [ ] Create auto-disbursement from brokerage to checking
- [ ] Run projection for 5 years
- [ ] Verify:
  - [ ] Retirement account dividends stay in account
  - [ ] Brokerage dividends contribute to cash flow
  - [ ] Surplus increases surplus asset
  - [ ] Auto-disbursements transfer correctly

### 10.2 Complete Loan Scenario
- [ ] Create amortized mortgage
- [ ] Enable "decrease by principal yearly"
- [ ] Enable "create payment expense"
- [ ] Set up income to cover mortgage payments
- [ ] Run projection
- [ ] Verify:
  - [ ] Mortgage expense appears in cash flow
- [ ] Liability decreases by principal each year
  - [ ] Principal and interest are tracked

---

## 11. Edge Cases & Error Handling

### 11.1 Account Deletion
- [ ] Create asset linked to an account
- [ ] Delete the account
- [ ] Verify asset's account_id is set to NULL
- [ ] Edit asset - verify Account dropdown shows "None"

### 11.2 Auto-Disbursement Edge Cases
- [ ] Create auto-disbursement with source = target (should be prevented or handled)
- [ ] Create auto-disbursement where source asset doesn't have enough value
- [ ] Verify graceful handling

### 11.3 Date Validation
- [ ] Create auto-disbursement with end_date < start_date (should be prevented)
- [ ] Test with dates outside projection range

---

## 12. UI/UX Testing

### 12.1 Form Field Order (Income/Expenses)
- [ ] Navigate to Income form
- [ ] Verify "Dynamic" field is in 4th position (after Category)
- [ ] Navigate to Expenses form
- [ ] Verify "Dynamic" field is in 4th position
- [ ] Verify "Inflation %" is editable (not disabled)

### 12.2 Liability Form
- [ ] Verify "Loan Type" dropdown works correctly
- [ ] Select "Amortized Loan" - field updates correctly
- [ ] All amortized loan fields appear and are functional

---

## 13. Data Persistence

### 13.1 Reload Testing
- [ ] Create/update accounts, assets, liabilities with new fields
- [ ] Refresh browser or log out and back in
- [ ] Verify all data persists correctly
- [ ] Verify account links remain
- [ ] Verify surplus asset setting remains
- [ ] Verify auto-disbursements are saved

---

## 14. Performance Testing

### 14.1 Large Dataset
- [ ] Create 20+ accounts
- [ ] Create 50+ assets linked to accounts
- [ ] Create multiple auto-disbursements
- [ ] Run projection - verify performance is acceptable

---

## Notes

1. **Surplus Asset Dropdown**: May need to be added to Profile Settings page if not already implemented.
2. **Auto-Disbursement UI**: May only be available via API initially - check if UI needs to be created.
3. **Monte Carlo Projections**: Currently a placeholder - basic functionality verification only.

---

## Priority Testing Order

1. **Critical**: Accounts Management, Asset-Account Linking, Amortized Loans
2. **High**: Surplus/Deficit Handling, Retirement Account Rules
3. **Medium**: Auto-Disbursements, Custom Chart Account Filtering
4. **Low**: Monte Carlo (placeholder), Edge Cases


# Financial Projection Testing Plan

## Overview
This plan provides systematic testing scenarios for all calculation aspects of the financial projection system. Each test can be run independently by creating/deleting test data.

---

## 1. Asset Calculations

### 1.1 Basic Asset Growth
**Setup:**
- Create 1 asset: $100,000, 5% annual growth, no start/end dates

**Test Cases:**
- [ ] Year 1: $100,000
- [ ] Year 2: $105,000 (100,000 * 1.05)
- [ ] Year 3: $110,250 (105,000 * 1.05)
- [ ] Verify compound growth formula: `initial * (1 + rate)^years`

**Verify in:**
- Custom Charts (asset value over time)
- Balance Sheet Projections
- Cash Flow Overview > BASE Model

### 1.2 Asset with Partial Year
**Setup:**
- Create 1 asset: $100,000, 5% annual growth
- Start date: July 1, 2026 (mid-year)
- End date: None

**Test Cases:**
- [ ] Year 2026: Should show ~$102,500 (half year: 100,000 * 1.05^0.5)
- [ ] Year 2027: Full year growth from 2026 end value
- [ ] Verify `calculateYearFraction` is applied correctly

**Verify in:**
- All projections and charts

### 1.3 Asset with End Date
**Setup:**
- Create 1 asset: $100,000, 5% annual growth
- Start date: Jan 1, 2026
- End date: June 30, 2027

**Test Cases:**
- [ ] Year 2026: Full year value
- [ ] Year 2027: Half year value (stops mid-year)
- [ ] Year 2028: $0 (asset no longer exists)

**Verify in:**
- All projections and charts

### 1.4 Multiple Assets with Different Growth Rates
**Setup:**
- Asset 1: $50,000, 3% growth
- Asset 2: $50,000, 7% growth

**Test Cases:**
- [ ] Total assets = sum of individual assets
- [ ] Each asset grows independently
- [ ] Aggregated values match sum of individual values

**Verify in:**
- Custom Charts (aggregated vs itemized)
- Balance Sheet Projections

---

## 2. Income Calculations

### 2.1 Fixed Income with Growth
**Setup:**
- Create 1 income: $100,000/year, 3% annual increase

**Test Cases:**
- [ ] Year 1: $100,000
- [ ] Year 2: $103,000 (100,000 * 1.03)
- [ ] Year 3: $106,090 (103,000 * 1.03)
- [ ] Verify compound growth: `base * (1 + rate)^year`

**Verify in:**
- Custom Charts
- Cash Flow Overview (all views)
- BASE Model

### 2.2 Income with Partial Year
**Setup:**
- Create 1 income: $200,000/year
- Start date: Jan 1, 2026
- End date: Aug 31, 2027

**Test Cases:**
- [ ] Year 2026: Full $200,000 (12 months)
- [ ] Year 2027: ~$133,333 (8 months: 200,000 * 8/12)
- [ ] Year 2028: $0

**Verify in:**
- All projections (especially BASE Model - was previously broken)

### 2.3 Dynamic Income Linked to Asset
**Setup:**
- Asset: $1,000,000, 5% growth
- Income: 4% of asset value annually

**Test Cases:**
- [ ] Year 1: Asset = $1,050,000, Income = $40,000 (1,000,000 * 0.04)
  - Asset grows: 1,000,000 * 1.05 = 1,050,000
  - Income based on beginning asset value: 1,000,000 * 0.04 = 40,000
- [ ] Year 2: Asset = $1,102,500, Income = $42,000 (1,050,000 * 0.04)
  - Asset grows: 1,050,000 * 1.05 = 1,102,500
  - Income based on previous year's asset value: 1,050,000 * 0.04 = 42,000
- [ ] Year 3: Asset = $1,157,625, Income = $44,100 (1,102,500 * 0.04)
  - Asset grows: 1,102,500 * 1.05 = 1,157,625
  - Income based on previous year's asset value: 1,102,500 * 0.04 = 44,100
- [ ] Income adjusts as asset grows (recalculated each year based on current asset value)

**Verify in:**
- Custom Charts
- Cash Flow Overview
- Verify income recalculates each year (not using stale values)

### 2.4 Income Contributing to Asset
**Setup:**
- Income: $100,000/year
- Asset: $0 initial, receives 100% of income

**Test Cases:**
- [ ] Year 1: Asset = $100,000 (from income contribution)
- [ ] Year 2: Asset = $200,000 (100,000 + 100,000)
- [ ] Verify income flows into asset correctly

**Verify in:**
- Balance Sheet Projections
- Custom Charts (asset value over time)

---

## 3. Expense Calculations

### 3.1 Fixed Expense with Inflation
**Setup:**
- Create 1 expense: $10,000/year, 2% inflation

**Test Cases:**
- [ ] Year 1: $10,000
- [ ] Year 2: $10,200 (10,000 * 1.02)
- [ ] Year 3: $10,404 (10,200 * 1.02)
- [ ] Verify inflation compound growth

**Verify in:**
- Custom Charts
- Cash Flow Overview

### 3.2 Expense with Partial Year
**Setup:**
- Create 1 expense: $12,000/year
- Start date: March 1, 2026
- End date: Dec 31, 2027

**Test Cases:**
- [ ] Year 2026: ~$10,000 (10 months: 12,000 * 10/12)
- [ ] Year 2027: Full $12,000
- [ ] Year 2028: $0

**Verify in:**
- All projections

### 3.3 Dynamic Expense Linked to Income (401K-style)
**Setup:**
- Income: $200,000/year, ends Aug 2027
- Expense: 10% of income, contributes to asset

**Test Cases:**
- [ ] Year 2026: Expense = $20,000 (200,000 * 0.10)
- [ ] Year 2027: Expense = ~$13,333 (prorated income * 0.10)
- [ ] Year 2028: Expense = $0 (income ended)
- [ ] **CRITICAL:** Expense must drop to $0 when income ends (was previously broken)

**Verify in:**
- Custom Charts (expense should match income pattern)
- Cash Flow Overview (all views)
- Balance Sheet Projections
- Verify expense recalculates each year (not using stale values)

### 3.4 Expense Contributing to Asset
**Setup:**
- Expense: $10,000/year
- Asset: $0 initial, receives 100% of expense

**Test Cases:**
- [ ] Year 1: Asset = $10,000
- [ ] Year 2: Asset = $20,000
- [ ] Verify expense flows into asset correctly

**Verify in:**
- Balance Sheet Projections
- Custom Charts

---

## 4. Liability Calculations

### 4.1 Simple Liability (Fixed)
**Setup:**
- Create 1 liability: $50,000, 0% growth

**Test Cases:**
- [ ] Value remains constant: $50,000 each year
- [ ] Verify negative value in calculations

**Verify in:**
- Balance Sheet Projections
- Custom Charts

### 4.2 Liability with Growth
**Setup:**
- Create 1 liability: $50,000, 3% annual increase

**Test Cases:**
- [ ] Year 1: $50,000
- [ ] Year 2: $51,500 (50,000 * 1.03)
- [ ] Year 3: $53,045

**Verify in:**
- All projections

### 4.3 Amortized Loan
**Setup:**
- Create 1 amortized loan: $100,000 principal, 5% interest, 30 years

**Test Cases:**
- [ ] Year 1: Balance = ~$98,000 (after 12 months of payments)
- [ ] Year 2: Balance = ~$96,000
- [ ] Balance decreases over time
- [ ] Monthly payment calculated correctly
- [ ] Final year: Balance = $0

**Verify in:**
- Balance Sheet Projections
- Custom Charts (liability balance over time)

---

## 5. Tax Calculations

### 5.1 Federal Income Tax (Calculated)
**Setup:**
- Income: $100,000/year (taxable)
- No other income/expenses

**Test Cases:**
- [ ] Federal tax calculated based on tax brackets
- [ ] Tax appears as expense in projections
- [ ] Tax amount matches expected bracket calculation

**Verify in:**
- Cash Flow Overview
- Custom Charts (expense category)
- BASE Model

### 5.2 Tax with Multiple Income Sources
**Setup:**
- Income 1: $80,000/year (taxable)
- Income 2: $20,000/year (taxable)

**Test Cases:**
- [ ] Total taxable income = $100,000
- [ ] Tax calculated on total, not individual
- [ ] Tax matches single $100,000 income scenario

**Verify in:**
- All projections

### 5.3 Tax with Non-Taxable Income
**Setup:**
- Income 1: $100,000/year (taxable)
- Income 2: $20,000/year (non-taxable, e.g., Roth IRA distributions)

**Test Cases:**
- [ ] Taxable income = $100,000 (not $120,000)
- [ ] Tax calculated only on taxable portion
- [ ] Total income = $120,000, but tax based on $100,000

**Verify in:**
- All projections

---

## 6. Complex Scenarios

### 6.1 Reinvested Dividends
**Setup:**
- Asset: $100,000, 5% growth
- Income: 2% dividends from asset, reinvested (contributes back to asset)

**Test Cases:**
- [ ] Year 1: Asset = $100,000
- [ ] Year 1: Dividend income = $2,000 (100,000 * 0.02)
- [ ] Year 1: Asset after reinvestment = $102,000 (or $105,000 if growth + dividend)
- [ ] Verify dividend income appears in income projections
- [ ] Verify dividend contributes back to asset

**Verify in:**
- Custom Charts (income and asset)
- Cash Flow Overview
- Balance Sheet Projections

### 6.2 Auto-Disbursements
**Setup:**
- Asset 1: $100,000 (source)
- Asset 2: $0 (destination)
- Auto-disbursement: $5,000/year from Asset 1 to Asset 2

**Test Cases:**
- [ ] Year 1: Asset 1 = $95,000, Asset 2 = $5,000
- [ ] Year 2: Asset 1 = $90,000, Asset 2 = $10,000
- [ ] Verify transfer occurs correctly
- [ ] Verify both assets still grow at their rates

**Verify in:**
- Balance Sheet Projections
- Custom Charts (both assets)

### 6.3 Surplus Asset Transfers
**Setup:**
- Income: $100,000/year
- Expenses: $80,000/year
- Surplus asset: Receives excess cash flow

**Test Cases:**
- [ ] Year 1: Surplus = $20,000 (100,000 - 80,000)
- [ ] Year 2: Surplus = $40,000 (accumulates)
- [ ] Verify surplus calculation: income - expenses
- [ ] Verify surplus asset grows with transfers

**Verify in:**
- Cash Flow Overview
- Balance Sheet Projections
- Custom Charts

### 6.4 Multiple Linked Items Chain
**Setup:**
- Asset: $1,000,000, 5% growth
- Income: 4% of asset (dynamic)
- Expense: 10% of income (dynamic), contributes to different asset

**Test Cases:**
- [ ] Asset grows → Income adjusts → Expense adjusts
- [ ] All values recalculate each year (not stale)
- [ ] Chain of dependencies works correctly

**Verify in:**
- Custom Charts (all three items)
- Cash Flow Overview
- Verify calculations update when source changes

---

## 7. Edge Cases

### 7.1 Zero Values
**Setup:**
- Asset: $0 initial value
- Income: $0/year
- Expense: $0/year

**Test Cases:**
- [ ] No division by zero errors
- [ ] Charts render correctly (show 0 or empty)
- [ ] Calculations handle zero gracefully

**Verify in:**
- All projections and charts

### 7.2 Negative Growth Rates
**Setup:**
- Asset: $100,000, -5% annual change

**Test Cases:**
- [ ] Year 1: $100,000
- [ ] Year 2: $95,000 (100,000 * 0.95)
- [ ] Year 3: $90,250
- [ ] Asset decreases over time

**Verify in:**
- All projections

### 7.3 Very High Growth Rates
**Setup:**
- Asset: $100,000, 50% annual growth

**Test Cases:**
- [ ] Year 1: $100,000
- [ ] Year 2: $150,000
- [ ] Year 3: $225,000
- [ ] Calculations handle large numbers correctly

**Verify in:**
- All projections
- Check for overflow/rounding issues

### 7.4 Overlapping Date Ranges
**Setup:**
- Income 1: Jan 1, 2026 - Dec 31, 2027
- Income 2: June 1, 2027 - Dec 31, 2028

**Test Cases:**
- [ ] Year 2027: Both incomes active (overlap)
- [ ] Year 2028: Only Income 2 active
- [ ] Partial year calculations correct for both

**Verify in:**
- All projections

### 7.5 Items Starting/Ending Mid-Year
**Setup:**
- Multiple items with various start/end dates throughout the year

**Test Cases:**
- [ ] Each item prorated correctly
- [ ] Total calculations sum correctly
- [ ] No gaps or overlaps in coverage

**Verify in:**
- All projections

---

## 8. Chart-Specific Tests

### 8.1 Custom Chart - All Items vs Specific Item
**Setup:**
- 3 expenses in "Investment" category
- Create chart with "All Items" for Investment category
- Create chart with specific expense selected

**Test Cases:**
- [ ] "All Items" chart shows sum of all 3 expenses
- [ ] Specific item chart shows only that expense
- [ ] Values match between charts

**Verify in:**
- Custom Charts

### 8.2 Custom Chart - Label Changes
**Setup:**
- Create chart with expense series
- Change the label (e.g., "401K" → "Retirement Savings")

**Test Cases:**
- [ ] Chart still shows correct data after label change
- [ ] No recalculation needed
- [ ] Label is display-only

**Verify in:**
- Custom Charts (edit chart, change label, save)

### 8.3 Chart Recalculation
**Setup:**
- Create chart
- Modify underlying data (e.g., change income amount)
- Recalculate chart

**Test Cases:**
- [ ] Chart updates with new values
- [ ] Old data replaced correctly
- [ ] No duplicate or stale data

**Verify in:**
- Custom Charts (recalculate individual and all charts)

---

## 9. Projection Comparison Tests

### 9.1 Consistency Across Projections
**Setup:**
- Create test data with income, expenses, assets, liabilities

**Test Cases:**
- [ ] Custom Charts match Cash Flow Overview
- [ ] BASE Model matches Overview for same items
- [ ] Balance Sheet Projections match asset/liability values
- [ ] Sankey Diagram matches other views
- [ ] Monte Carlo averages match BASE Model

**Verify in:**
- All projection types side-by-side

### 9.2 Monte Carlo Validation
**Setup:**
- Simple scenario: $100,000 income, $80,000 expenses

**Test Cases:**
- [ ] Run 1,000 simulations
- [ ] Average result ≈ BASE Model
- [ ] Results show reasonable variance
- [ ] No infinite loops or crashes
- [ ] Percentiles calculated correctly (10th, 50th, 90th)

**Verify in:**
- Monte Carlo Projections

---

## 10. Data Integrity Tests

### 10.1 Item Deletion
**Setup:**
- Create chart/projection with specific items
- Delete one of the items

**Test Cases:**
- [ ] Chart/projection handles missing item gracefully
- [ ] No errors or crashes
- [ ] Remaining items still calculate correctly

**Verify in:**
- All projections after deleting data

### 10.2 Item Renaming
**Setup:**
- Create chart with expense "401K deduction"
- Rename expense to "Retirement Contribution"

**Test Cases:**
- [ ] Chart still works (matches by ID, not name)
- [ ] Data recalculates if needed
- [ ] Label can be updated independently

**Verify in:**
- Custom Charts

### 10.3 Account Changes
**Setup:**
- Asset linked to account
- Change account details

**Test Cases:**
- [ ] Asset calculations unaffected
- [ ] Account name changes reflected in displays
- [ ] No calculation errors

**Verify in:**
- Asset views
- Balance Sheet Projections

---

## Testing Checklist Summary

### Quick Smoke Tests (5 minutes)
- [ ] Create simple asset, verify growth
- [ ] Create income with partial year, verify proration
- [ ] Create expense linked to income, verify it updates
- [ ] Create chart, verify data displays

### Core Functionality (30 minutes)
- [ ] All basic calculations (assets, income, expenses, liabilities)
- [ ] Partial year calculations
- [ ] Dynamic linked items
- [ ] Tax calculations

### Advanced Scenarios (1 hour)
- [ ] Complex chains (asset → income → expense)
- [ ] Auto-disbursements
- [ ] Reinvested dividends
- [ ] Surplus transfers

### Edge Cases (30 minutes)
- [ ] Zero values
- [ ] Negative growth
- [ ] Overlapping dates
- [ ] Item deletion/renaming

### Integration Tests (30 minutes)
- [ ] Consistency across all projections
- [ ] Chart recalculation
- [ ] Monte Carlo validation

---

## Notes

1. **Test Data Management:**
   - Use separate test users for different scenarios
   - Delete test data after each test to avoid contamination
   - Document expected values before running tests

2. **Verification Points:**
   - Console logs (check for errors)
   - Backend logs (check calculation debug messages)
   - UI values (compare across views)
   - Mathematical correctness (verify formulas)

3. **Known Issues to Watch:**
   - Dynamic expenses linked to income must recalculate each year
   - Partial year calculations must use `calculateYearFraction`
   - Labels should never affect data matching
   - Charts should work after item renaming

4. **Regression Testing:**
   - After any calculation changes, re-run critical tests:
     - Dynamic expense linked to income (401K scenario)
     - Partial year income/expense calculations
     - BASE Model consistency

---

## Test Execution Log Template

```
Test: [Test Name]
Date: [Date]
User: [Test User ID]
Setup: [What data was created]
Expected: [Expected results]
Actual: [Actual results]
Status: [PASS/FAIL]
Notes: [Any observations]
```

# Test Checklist: `linked_asset_ids` Multi-Select Support

**Purpose:** Verify that recent changes supporting `linked_asset_ids` (multi-select) for dividend income items don't break existing functionality.

**Files Changed:**
- `ui/src/components/CashFlowOverview.jsx`
- `ui/src/components/CashFlowSummary.jsx`

**Date:** 2026-01-16

---

## Test Categories

### ✅ 1. Fixed Income Items (No Links)

**Purpose:** Verify fixed income items (not linked to assets) still work correctly.

**Test Steps:**
1. Create a fixed income item:
   - Description: "Test Fixed Income"
   - Category: Any (e.g., "Salary")
   - Value: $50,000
   - Frequency: Yearly
   - No linked assets
2. View in **Cash Flow Overview** → Check Income totals
3. View in **Cash Flow Summary** → Check Income totals
4. View in **Sankey Diagram** → Check Cash In

**Expected Results:**
- ✅ Shows $50,000 in all views for Year 1
- ✅ Applies annual increase % correctly (if set)
- ✅ No regressions from previous behavior

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

---

### ✅ 2. Single-Select Income Linked to Asset (`linked_item_id`)

**Purpose:** Verify backward compatibility - items using old `linked_item_id` pattern still work.

**Test Steps:**
1. Create an asset:
   - Name: "Test Asset Single"
   - Value: $100,000
   - Annual Increase: 5%
2. Create an income item linked to this asset:
   - Description: "Test Dividend Single"
   - Category: "Dividends (qualified)" or "Dividends (unqualified)"
   - Linked Item Type: Asset
   - Linked Asset: "Test Asset Single" (single-select)
   - Percentage: 2%
   - **Important:** Use single-select (old pattern, should populate `linked_item_id`)
3. View in **Cash Flow Overview** → Check Income totals
4. View in **Cash Flow Summary** → Check Income totals
5. View in **Sankey Diagram** → Check Cash In
6. Verify **Custom Charts** → Income shows correct values

**Expected Results:**
- ✅ Year 1: Income = $2,000 (100,000 * 0.02)
- ✅ Year 2: Income = $2,100 (105,000 * 0.02)
- ✅ Year 3: Income = $2,205 (110,250 * 0.02)
- ✅ Values match across all views
- ✅ No regressions from previous behavior

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

---

### ✅ 3. Multi-Select Income Linked to Assets (`linked_asset_ids`)

**Purpose:** Verify new functionality - dividend items using `linked_asset_ids` work correctly.

**Test Steps:**
1. Create two assets:
   - Asset 1: Name "Test Asset A", Value $100,000, Annual Increase 5%
   - Asset 2: Name "Test Asset B", Value $50,000, Annual Increase 3%
2. Create an income item linked to both assets:
   - Description: "Test Dividend Multi"
   - Category: "Dividends (qualified)"
   - Linked Item Type: Asset
   - **Linked Assets: Select BOTH "Test Asset A" and "Test Asset B"** (multi-select)
   - Percentage: 2%
3. **Uncheck "Reinvest Dividends"** (to see in cash flow)
4. View in **Cash Flow Overview** → Check Income totals
5. View in **Cash Flow Summary** → Check Income totals
6. View in **Sankey Diagram** → Check Cash In
7. Verify **Custom Charts** → Income shows correct values

**Expected Results:**
- ✅ Year 1: Income = $3,000 (100,000 + 50,000) * 0.02
- ✅ Year 2: Income = $3,130 (105,000 + 51,500) * 0.02
- ✅ Year 3: Income ≈ $3,265 (110,250 + 53,045) * 0.02
- ✅ Values appear in **Cash Flow Projections** (not 0)
- ✅ Values match across all views

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

---

### ✅ 4. Dividend with "Reinvest Dividends" Unchecked

**Purpose:** Verify dividends appear in cash flow when NOT reinvested (original bug fix).

**Test Steps:**
1. Use test from **#3** (multi-select dividend) OR create a single dividend linked to one asset
2. Ensure **"Reinvest Dividends" checkbox is UNCHECKED**
3. View **Cash Flow Overview** → "Cash Flow Projections" tab
4. Check **Cash In** values for Years 1, 2, 3
5. Verify **BASE model** (cash flow table) shows income
6. Verify **Sankey Diagram** shows cash in from dividends

**Expected Results:**
- ✅ Dividend income appears in **Cash In** (not $0)
- ✅ Year 1: Cash In includes dividend amount
- ✅ Year 2: Cash In includes updated dividend amount
- ✅ All three cash flow views (Overview, BASE, Sankey) show consistent values

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

---

### ✅ 5. Dividend with "Reinvest Dividends" Checked

**Purpose:** Verify dividends DON'T appear in cash flow when reinvested (existing behavior).

**Test Steps:**
1. Use test from **#3** (multi-select dividend) OR create a single dividend linked to one asset
2. Ensure **"Reinvest Dividends" checkbox is CHECKED**
3. Select a **Reinvestment Account** (the asset itself or another asset)
4. View **Cash Flow Overview** → "Cash Flow Projections" tab
5. Check **Cash In** values for Years 1, 2, 3
6. Verify dividends are **NOT** counted as cash in
7. Verify dividends **ARE** added to asset balance (check Custom Charts → Assets)

**Expected Results:**
- ✅ Dividend income does **NOT** appear in **Cash In** (should be $0 or excluded)
- ✅ Asset value increases by dividend amount (check Custom Charts)
- ✅ No regressions from previous reinvestment behavior

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

---

### ✅ 6. Expenses Linked to Income (That Is Linked to Assets)

**Purpose:** Verify nested scenarios - expenses linked to income that uses `linked_asset_ids` still work.

**Test Steps:**
1. Create an asset:
   - Name: "Test Asset Nested"
   - Value: $100,000
   - Annual Increase: 5%
2. Create an income item (using multi-select if possible):
   - Description: "Test Dividend Nested"
   - Linked Assets: "Test Asset Nested"
   - Percentage: 2%
3. Create an expense linked to this income:
   - Description: "Test Expense from Dividend"
   - Linked Item Type: Income
   - Linked Income: "Test Dividend Nested"
   - Percentage: 50% (so expense = 50% of dividend income)
4. View in **Cash Flow Overview** → Check both Income and Expenses
5. View in **Cash Flow Summary** → Check Income and Expenses

**Expected Results:**
- ✅ Year 1: Income = $2,000, Expense = $1,000 (50% of income)
- ✅ Year 2: Income = $2,100, Expense = $1,050
- ✅ Year 3: Income = $2,205, Expense = $1,102.50
- ✅ Expense correctly calculates from dynamic dividend income
- ✅ No regressions from previous nested behavior

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

---

### ✅ 7. Mixed Scenarios (Multiple Income Types)

**Purpose:** Verify system works correctly with a mix of fixed, single-select, and multi-select income items.

**Test Steps:**
1. Create:
   - Fixed income: $50,000 salary
   - Single-select dividend: 2% of Asset A ($100,000)
   - Multi-select dividend: 2% of Asset B ($50,000) + Asset C ($25,000)
2. View **Cash Flow Overview** → Total Income
3. Verify each type calculates correctly

**Expected Results:**
- ✅ Year 1 Total Income = $50,000 + $2,000 + $1,500 = $53,500
- ✅ Year 2: All items update correctly
- ✅ No double-counting or missing items
- ✅ All income types work simultaneously

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

---

## Regression Tests from TESTING_PLAN.md

If the above tests pass, also verify these existing test scenarios still work:

### ✅ 8. Section 3.3: Dynamic Expense Linked to Income (401K-style)
- **Expected:** Expense correctly contributes to asset balance
- **Verify:** Asset value increases by expense amount each year

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

### ✅ 9. Section 6.1: Reinvested Dividends (if applicable)
- **Expected:** Dividend reinvestment still works when checked
- **Verify:** Asset value includes reinvested dividends

**Status:** ☐ Pass ☐ Fail ☐ Not Tested

---

## Summary

**Total Tests:** 9

**Results:**
- ✅ Passed: ___
- ❌ Failed: ___
- ⏸️ Not Tested: ___

**Critical Issues Found:** (list any regressions or bugs discovered)

---

## Notes

- All changes are **additive** - they add support for `linked_asset_ids` without removing `linked_item_id` support
- Backward compatibility is maintained through fallback logic
- If a test fails, document:
  - Which test failed
  - Expected vs. actual values
  - Screenshots if helpful
  - Steps to reproduce

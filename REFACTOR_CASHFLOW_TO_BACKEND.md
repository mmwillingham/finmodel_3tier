# Refactoring Plan: Cash Flow Overview to Use Backend Projection API

## Overview
Refactor `CashFlowOverview.jsx` to use the backend projection API instead of calculating everything in JavaScript. This will:
- Eliminate code duplication between frontend and backend
- Ensure consistency between Cash Flow Overview and Balance Sheet Projections
- Fix issues like dividends/interest showing 0 in charts (since they'll use the same data source)
- Improve maintainability by having a single source of truth for calculations

## Current State

### Backend (`api/calculations.py`)
- Already calculates income/expense flows
- Stores in `data_json` with:
  - `Total Income Flow`
  - `Total Expense Flow`
  - `Net Cash Flow`
  - Individual income/expense items as `ItemName_Value`
  - Individual asset/liability balances as `AssetName_Value`

### Frontend (`ui/src/components/CashFlowOverview.jsx`)
- Calculates everything in JavaScript:
  - Income/expense values year-by-year
  - Asset projections for dynamic items (dividends/interest)
  - Cash in/out flows
  - Beginning/ending balances
  - Surplus transfers
  - Auto-disbursement transfers
- Has duplicate logic for:
  - Year fraction calculations
  - Dynamic item calculations (linked to assets)
  - Growth rate applications
  - Tax calculations

## Refactoring Steps

### Phase 1: Enhance Backend Data (if needed)

**Check if backend already provides all needed data:**
- [ ] Review what Cash Flow Overview currently calculates
- [ ] Compare with what backend `data_json` contains
- [ ] Identify any missing fields

**Potential enhancements to backend:**
- [ ] Add category totals to `data_json` (e.g., `Income_CategoryName_Total`, `Expense_CategoryName_Total`)
- [ ] Add cash asset beginning/ending balances if not already present
- [ ] Add surplus transfer amounts explicitly
- [ ] Add auto-disbursement transfer amounts explicitly

**Files to modify:**
- `api/calculations.py` - Add any missing fields to `yearly_data_points`

### Phase 2: Create Cash Flow Projection Service Call

**Similar to Balance Sheet Projection:**
- [ ] Create/update a "Cash Flow Projection" projection in backend
- [ ] Include all income, expense, asset, and liability accounts
- [ ] Use same projection API endpoints

**Files to modify:**
- `ui/src/components/CashFlowOverview.jsx` - Add projection fetch logic similar to `BalanceSheetProjection.jsx`

### Phase 3: Replace Frontend Calculations

**Replace calculation functions:**
1. Remove `calculateCashFlowProjection()` function
2. Remove `calculateBaseModel()` function  
3. Remove duplicate asset projection calculations
4. Remove duplicate income/expense calculations
5. Parse `data_json` from backend instead

**Update data parsing:**
- [ ] Create `parseProjectionData()` function to extract needed values from `data_json`
- [ ] Map backend field names to frontend chart data structure
- [ ] Handle category totals (either calculate from individual items or use backend totals if added)

**Files to modify:**
- `ui/src/components/CashFlowOverview.jsx` - Major refactoring

### Phase 4: Update Charts and Tables

**Update data sources:**
- [ ] Cash Flow Chart: Use `Total Income Flow` and `Total Expense Flow` from backend
- [ ] Individual charts: Use individual `ItemName_Value` fields from backend
- [ ] Sankey Diagram: Use backend data for income/expense values
- [ ] Base Model Table: Use backend data for beginning/ending balances

**Files to modify:**
- `ui/src/components/CashFlowOverview.jsx` - Update chart data sources
- `ui/src/components/CashFlowSummary.jsx` - Potentially update to use same projection

### Phase 5: Handle Auto-Disbursements and Surplus

**Current state:**
- Backend already handles auto-disbursements and surplus transfers in calculations
- Need to verify these are reflected in asset balances in `data_json`

**Actions:**
- [ ] Verify auto-disbursements affect asset balances in backend data
- [ ] Verify surplus transfers affect asset balances in backend data
- [ ] If needed, add explicit transfer fields to `data_json` for chart display

**Files to check/modify:**
- `api/calculations.py` - Verify auto-disbursements and surplus are in `data_json`
- `ui/src/components/CashFlowOverview.jsx` - Use backend data for transfers

### Phase 6: Handle Dynamic Updates

**Trigger recalculation when data changes:**
- [ ] Add `useEffect` to trigger projection update when income/expense/asset/liability data changes
- [ ] Similar to how `BalanceSheetProjection.jsx` uses `fetchProjectionData` in `useEffect`

**Files to modify:**
- `ui/src/components/CashFlowOverview.jsx` - Add dependency tracking

### Phase 7: Testing and Validation

**Compare results:**
- [ ] Compare frontend-calculated vs backend-calculated values
- [ ] Verify dividends/interest show correctly in charts
- [ ] Verify tax calculations match
- [ ] Verify one-time items are handled correctly
- [ ] Verify date proration matches

**Test scenarios:**
- [ ] Basic income/expense projections
- [ ] Dynamic items (dividends, interest linked to assets)
- [ ] One-time income/expenses
- [ ] Auto-disbursements
- [ ] Surplus transfers
- [ ] Tax calculations

## Implementation Notes

### Projection Name
Use `"Cash Flow Projection"` as the projection name, similar to `"Balance Sheet Projection"`

### Data Structure Mapping

**Backend → Frontend:**
```
data_json[year]["Total Income Flow"] → cashFlowProjection.incomeValues[year]
data_json[year]["Total Expense Flow"] → cashFlowProjection.expenseValues[year]
data_json[year]["Net Cash Flow"] → cashFlowProjection.surplus[year]
data_json[year]["ItemName_Value"] → individual income/expense values
```

### Category Totals
Two options:
1. Calculate from individual items in frontend (simpler, no backend changes)
2. Add category totals to backend `data_json` (better performance, requires backend changes)

Recommendation: Start with Option 1, add Option 2 later if performance is an issue.

### Cash Asset Balances
Backend already stores asset balances as `AssetName_Value`. For cash assets:
- Beginning balance = previous year's `AssetName_Value` or initial value
- Ending balance = current year's `AssetName_Value`

### Backward Compatibility
- Keep the same component interface (props) so parent components don't need changes
- Maintain same chart/table structure for users

## Estimated Impact

### Files to Modify
1. `ui/src/components/CashFlowOverview.jsx` - Major refactoring (~500-800 lines changed)
2. `ui/src/components/CashFlowSummary.jsx` - Potentially update to use same projection
3. `api/calculations.py` - Possibly add category totals or other fields

### Benefits
- Eliminate ~500+ lines of duplicate calculation code
- Single source of truth for all financial calculations
- Fix consistency issues (like dividends/interest showing 0)
- Easier to maintain and debug
- Better performance (calculations done once on backend)

### Risks
- Need to ensure backend calculations match frontend exactly
- May need to adjust backend to expose additional data
- Requires thorough testing to ensure no regressions

## Next Steps

1. Review this plan with team
2. Start with Phase 1: Review what backend already provides
3. Implement Phase 2: Add projection fetch logic
4. Gradually replace frontend calculations (Phase 3-4)
5. Test thoroughly (Phase 7)

## Future Enhancements

After this refactor:
- Consider caching projections for better performance
- Add ability to save/load different cash flow scenarios
- Unify Monte Carlo to also use backend calculations
- Create a unified projection service that handles all projection types

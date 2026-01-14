# Analysis: `projection_time_series_data` Table

## Current Status

**Table Size**: 15,690 rows  
**Purpose**: Store detailed time-series data for projections (account balances, contribution flows, growth values, aggregates)  
**Status**: **REDUNDANT and NOT ACTIVELY USED**

## Key Findings

### 1. **Data is Being Written, But Never Read**

The table is populated in:
- `api/calculations.py` (lines 754-771, 1077-1082): Creates `time_series_data_for_db`
- `api/main.py` (lines 739-741, 821-823, 936-938): Saves to database

**However**, the API explicitly avoids loading it:
- Line 770: `# Don't eagerly load time_series_data to save memory`
- Line 875: `# Don't eagerly load time_series_data to save memory`

### 2. **API Responses Always Return Empty Arrays**

All projection endpoints return:
```python
time_series_data: []  # Excluded to save memory - use data_json instead
```

With explicit comments:
- Line 747: `"Note: We exclude time_series_data from the response to save memory since data_json contains all the information"`
- Line 757: `time_series_data=[],  # Excluded to save memory - use data_json instead`
- Line 934: `"Note: We still save time_series_data for historical tracking, but we don't return it in the response"`

### 3. **Redundant with `data_json`**

The `projections.data_json` field contains the **same information** in JSON format and is what's actually used:
- `ui/src/components/Chart.jsx`: Uses `data_json`
- `ui/src/components/BalanceSheetProjection.jsx`: Uses `data_json`
- `ui/src/components/CustomChartView.jsx`: Uses `data_json`
- All API responses include `data_json` and exclude `time_series_data`

### 4. **Broken Frontend Component**

`ui/src/components/ProjectionChart.jsx` (lines 97-122) tries to use `time_series_data`:
```javascript
if (!proj || !proj.time_series_data || proj.time_series_data.length === 0) {
  return <div>No projection data available to chart.</div>;
}
// ... uses proj.time_series_data ...
```

**This component is BROKEN** because the API always returns `time_series_data: []`, so it will always show "No projection data available to chart."

## Storage Impact

With 15,690 rows, this table represents:
- **Per account per year**: 3 records (account_balance, contribution_flow, growth_value)
- **Per year aggregates**: 6 records (total_assets, total_liabilities, net_worth, total_income_flow, total_expense_flow, net_cash_flow)
- **Per projection**: (3 × num_accounts × num_years) + (6 × num_years)

Example: A projection with 10 accounts over 30 years = (3 × 10 × 30) + (6 × 30) = 900 + 180 = 1,080 rows

Your 15,690 rows suggests approximately 14-15 projections have been calculated.

## Recommendations

### Option 1: **Remove the Table (Recommended)**

**Pros:**
- Eliminates redundancy (all data exists in `data_json`)
- Reduces database storage and write overhead
- Simplifies codebase
- Prevents confusion about which data source to use

**Cons:**
- Requires database migration to drop the table
- Need to fix `ProjectionChart.jsx` to use `data_json`

**Steps:**
1. Fix `ui/src/components/ProjectionChart.jsx` to use `data_json` instead of `time_series_data`
2. Remove `time_series_data_for_db` creation from `api/calculations.py`
3. Remove `time_series_data` saving from `api/main.py`
4. Remove `time_series_data` field from schemas (or keep for backward compatibility, but always return `[]`)
5. Remove `time_series_data` relationship from `api/models.py`
6. Create database migration to drop the table
7. Remove `ProjectionTimeSeriesData` model from `api/models.py`

### Option 2: **Keep the Table, Fix the Broken Component**

**Pros:**
- Preserves "historical tracking" capability (mentioned in comments)
- No database migration needed
- Could enable future SQL-based queries on individual account values

**Cons:**
- Continues to store redundant data (15,690+ rows)
- Requires maintaining two data sources
- Confusing for developers (which source to use?)
- The "historical tracking" benefit is unclear (data is in `data_json`)

**Steps:**
1. Fix `ui/src/components/ProjectionChart.jsx` to use `data_json` instead of `time_series_data`
2. Add comment in code explaining why the table exists but isn't used
3. Consider whether "historical tracking" is actually needed

## Recommendation: **Option 1 (Remove the Table)**

The table appears to be legacy code from before `data_json` was implemented. The comment about "historical tracking" seems like a justification rather than an actual use case, since all the same data exists in `data_json`.

The broken `ProjectionChart.jsx` component suggests this table was abandoned mid-development, and all new code uses `data_json` instead.

**Impact**: Removing this table will:
- Free up database storage
- Reduce write overhead (currently writing ~1,000+ rows per projection calculation)
- Simplify the codebase
- Fix the broken `ProjectionChart.jsx` component

**Risk**: Low - The table is not queried anywhere, and all active code uses `data_json`.

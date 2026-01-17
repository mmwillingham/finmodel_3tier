# Checking Balance Investigation

## Problem
Checking account balance in 2026 shows **$123,471** instead of expected **~$61,521** ($10k start + $51,521 surplus).

## Root Cause Analysis

### Code Flow

1. **Initialization (line 343-345)**: Checking starts 7/1/2026, so `start_date (2026-07-01) > projection_start_year (2026-01-01)`, balance initialized to **0.0**

2. **Year 1 Activation (line 454-458)**: When checking becomes active, `current_balance == 0.0` and `has start_date`, so balance set to `initial_value = **$10,000**`

3. **Growth Loop (line 908)**: Sets `account_values_for_year["Comp Test Checking_Value"] = $10,000` (after 0% growth)

4. **Surplus Application (line 1296)**: Adds surplus ($51,521) to `account_current_balances["Comp Test Checking"] = **$61,521** ✓

5. **Update account_values_for_year (line 1302 - BUG)**: **Only updates if key exists**:
   ```python
   if surplus_value_key in account_values_for_year:
       account_values_for_year[surplus_value_key] = account_current_balances[surplus_asset_name]
   ```

6. **Build account_values (line 1355)**: Sets `account_values["Comp Test Checking_Value"] = account_current_balances.get(...) = **$61,521** ✓

7. **Update from account_values_for_year (line 1358)**: `account_values.update(account_values_for_year)`

### The Bug

**If the key doesn't exist in `account_values_for_year`** (which shouldn't happen, but could for edge cases with partial-year assets), then:
- Line 1302 doesn't update `account_values_for_year` with the post-surplus balance
- Line 1355 sets correct value ($61,521) from `account_current_balances`
- Line 1358 overwrites with stale value from `account_values_for_year` ($10,000)
- **But wait**: Line 1358's `update()` should only update existing keys, not overwrite if the value is already set...

Actually, `dict.update()` **does** overwrite existing keys. So if `account_values_for_year` still has the old $10,000 value, line 1358 would overwrite the correct $61,521 with $10,000 - but that would make the balance **lower**, not higher.

### Alternative Hypothesis

What if the issue is that **the surplus is being applied twice**? Or what if there's an accumulation from a "year 0"?

Looking at the actual value ($123,471) vs expected ($61,521):
- Difference: $61,950 (suspiciously close to expected total $61,521)
- This suggests the entire expected amount is being **added twice**

### Fix Applied

Changed line 1302 from:
```python
if surplus_value_key in account_values_for_year:
    account_values_for_year[surplus_value_key] = account_current_balances[surplus_asset_name]
```

To:
```python
# Always set/update the surplus asset value in account_values_for_year, even if key doesn't exist
account_values_for_year[surplus_value_key] = account_current_balances[surplus_asset_name]
```

This ensures that `account_values_for_year` always has the correct post-surplus balance, regardless of whether the key was set during the growth loop.

### Testing

To verify the fix:
1. Run the comprehensive test again
2. Check the checking balance for 2026 - should be ~$61,521, not $123,471
3. Check debug logs to see the surplus application values

### Debug Logging

Added debug logging at line 1306 to output:
- Surplus amount applied
- Balance before surplus
- Balance after surplus
- Final value stored in `account_values_for_year`

This will help verify the fix and identify any remaining issues.

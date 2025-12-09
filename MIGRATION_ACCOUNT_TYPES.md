# Account Type Migration for Existing Projections

## Problem
Existing projections in the database have `accounts_json` that doesn't include the `type` field for accounts. While new projections correctly save account types (as defined in the `AccountSchema`), historical data needs to be migrated.

## Solution
This migration adds a default account type (`"Other/Custom"`) to all accounts in existing projections that don't already have a type field.

## Migration Files

### Option 1: Simple Migration (Recommended)
**File:** `add_account_types_simple.sql`

This is the recommended approach. It uses a single UPDATE statement with PostgreSQL's JSONB functions to:
1. Check each account in the `accounts_json` field
2. Add a `type: "Other/Custom"` field if it doesn't exist
3. Only update projections that actually need the update

### Option 2: Function-Based Migration
**File:** `add_account_types_to_projections.sql`

This approach creates a reusable function to process the JSON. It's more verbose but can be useful if you need to run the migration multiple times or want to keep the function for future use.

## How to Run the Migration

### Prerequisites
- PostgreSQL database access
- Connection credentials (host, user, password, database name)
- Backup of your database (recommended)

### Steps

1. **Backup your database** (IMPORTANT!)
   ```bash
   pg_dump -h 127.0.0.1 -U bolauder -d finmodel > backup_before_migration.sql
   ```

2. **Run the simple migration:**
   ```bash
   psql -h 127.0.0.1 -U bolauder -d finmodel -f add_account_types_simple.sql
   ```

   Or if you prefer the function-based approach:
   ```bash
   psql -h 127.0.0.1 -U bolauder -d finmodel -f add_account_types_to_projections.sql
   ```

3. **Verify the results:**
   ```bash
   psql -h 127.0.0.1 -U bolauder -d finmodel -c "SELECT id, name, accounts_json FROM projections LIMIT 5;"
   ```

   Check that each account in the `accounts_json` now has a `type` field.

## What Gets Changed

### Before Migration
```json
[
  {
    "name": "Main Savings",
    "initial_balance": 10000,
    "monthly_contribution": 200,
    "annual_rate_percent": 4.5
  }
]
```

### After Migration
```json
[
  {
    "name": "Main Savings",
    "type": "Other/Custom",
    "initial_balance": 10000,
    "monthly_contribution": 200,
    "annual_rate_percent": 4.5
  }
]
```

## Default Type Value
The migration sets the default type to `"Other/Custom"`, which is one of the valid investment types defined in the UI:
- "--- Select Type ---"
- "Cash (Checking/Current)"
- "Savings (High-Yield)"
- "Brokerage (Taxable)"
- "Retirement (Tax-Advantaged)"
- "Real Estate"
- **"Other/Custom"** ← Default used in migration

Users can edit their projections after the migration to set the correct account type.

## Rollback
If you need to rollback the migration, restore from your backup:
```bash
psql -h 127.0.0.1 -U bolauder -d finmodel < backup_before_migration.sql
```

## Testing
After running the migration:
1. Start the API server: `cd api && uvicorn main:app --reload`
2. Start the UI: `cd ui && npm start`
3. Log in and view existing projections
4. Verify that you can view and edit projections without errors
5. Check that the account type dropdown shows "Other/Custom" for migrated accounts
6. Edit a projection and change the account type to a more specific type (e.g., "Savings (High-Yield)")
7. Save the projection and verify the new type is persisted

## Verification
You can also run the included test scripts:
- **Python logic test**: `python3 test_migration.py` - Tests the JSON transformation logic
- **Database test**: `./test_migration.sh` - Tests the full database migration (requires PostgreSQL running)
- **API integration test**: `python3 test_api_integration.py` - Tests the Pydantic schemas (requires dependencies installed)

## Technical Details
- The migration uses PostgreSQL's `jsonb_array_elements` to iterate through accounts
- It uses the `?` operator to check if a field exists in JSONB
- The `||` operator concatenates JSONB objects
- The migration is idempotent - accounts that already have a `type` field are not modified

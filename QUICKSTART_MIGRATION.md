# Quick Start: Account Type Migration

## Overview
This PR adds SQL migration scripts to update existing projections with account types.

## Problem
Existing projections have `accounts_json` without a `type` field. The application code already handles account types correctly, but historical data needs migration.

## Quick Migration Steps

### 1. Backup Database
```bash
pg_dump -h 127.0.0.1 -U bolauder -d finmodel > backup.sql
```

### 2. Run Migration
```bash
psql -h 127.0.0.1 -U bolauder -d finmodel -f add_account_types_simple.sql
```

### 3. Verify
```bash
psql -h 127.0.0.1 -U bolauder -d finmodel -c "SELECT id, name, accounts_json FROM projections LIMIT 3;"
```

## Files Added

### Migration Scripts
- `add_account_types_simple.sql` - **USE THIS** - Simple, recommended migration
- `add_account_types_to_projections.sql` - Alternative function-based approach

### Test Scripts
- `test_migration.py` - Python logic tests (✓ all pass, run without DB)
- `test_migration.sh` - Database migration test (requires PostgreSQL)
- `test_api_integration.py` - API schema tests (requires dependencies)

### Documentation
- `MIGRATION_ACCOUNT_TYPES.md` - Complete instructions and examples
- `MIGRATION_SUMMARY.md` - Root cause analysis and detailed solution
- `QUICKSTART_MIGRATION.md` - This file

## What Gets Changed
Adds `"type": "Other/Custom"` to accounts that don't have a type field:

```json
// Before
{"name": "Savings", "initial_balance": 10000}

// After
{"name": "Savings", "type": "Other/Custom", "initial_balance": 10000}
```

## Risk Level
**Low** - Only adds data, doesn't modify or delete. Fully reversible with backup.

## Testing
```bash
# Test the logic (no database required)
python3 test_migration.py

# Test with database (requires PostgreSQL running)
export PGPASSWORD="your_password"
./test_migration.sh
```

## Need Help?
See `MIGRATION_ACCOUNT_TYPES.md` for detailed instructions.

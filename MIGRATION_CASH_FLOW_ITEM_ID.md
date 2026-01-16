# Migration Guide: Add cash_flow_item_id to projected_accounts

This guide explains how to run the migration that adds the `cash_flow_item_id` column to the `projected_accounts` table.

## Migration Order

**IMPORTANT:** Run these steps in order:

1. ✅ **Migration** (this step) - Add database column
2. ✅ **Deploy** - Deploy new application code
3. ✅ **Test** - Verify everything works

## Prerequisites

Make sure you have:
- Database credentials set as environment variables (DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT)
- OR your database connection configured in `api/database.py`
- Alembic installed (`pip install alembic`)

## Step 1: Check Current Migration Status

```bash
cd /home/mwilling/git/finmodel_3tier/api
alembic current
```

Expected output should show the current revision (likely `c134ab7e66dc`).

## Step 2: Check Pending Migrations

```bash
cd /home/mwilling/git/finmodel_3tier/api
alembic heads
```

Should show `3ec80f20558c` (our new migration).

## Step 3: Run the Migration

```bash
cd /home/mwilling/git/finmodel_3tier/api
alembic upgrade head
```

This will:
- Add `cash_flow_item_id` column to `projected_accounts` table
- Create foreign key constraint to `cashflow_items.id`
- Create index on `cash_flow_item_id` for faster lookups

Expected output:
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade c134ab7e66dc -> 3ec80f20558c, add_cash_flow_item_id_to_projected_accounts
```

## Step 4: Verify Migration Success

```bash
cd /home/mwilling/git/finmodel_3tier/api
alembic current
```

Should now show `3ec80f20558c`.

## Step 5: Verify Database Schema

You can verify the column was added by checking the database:

```sql
-- Connect to your database, then run:
\d projected_accounts
```

Or using psql:
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d projected_accounts" | grep cash_flow_item_id
```

Expected output should show:
```
cash_flow_item_id | integer | nullable
```

## Rollback (if needed)

If you need to rollback the migration:

```bash
cd /home/mwilling/git/finmodel_3tier/api
alembic downgrade c134ab7e66dc
```

**Note:** This will remove the `cash_flow_item_id` column. Only do this if you haven't deployed the new code yet.

## Troubleshooting

### Error: "Missing database environment variables"

Set the required environment variables:
```bash
export DB_USER=your_username
export DB_PASSWORD=your_password
export DB_NAME=your_database
export DB_HOST=your_host
export DB_PORT=5432
```

### Error: "Connection refused"

- Check that your database is running
- Verify connection details (host, port, credentials)
- If using Cloud SQL proxy, make sure it's running

### Error: "Table 'projected_accounts' does not exist"

Run all previous migrations first:
```bash
alembic upgrade head
```

## What This Migration Does

1. **Adds `cash_flow_item_id` column** (nullable Integer) to `projected_accounts` table
2. **Creates foreign key** from `projected_accounts.cash_flow_item_id` → `cashflow_items.id`
   - `ON DELETE SET NULL` - If cash flow item is deleted, the ID is set to NULL (preserves projection data)
3. **Creates index** on `cash_flow_item_id` for faster lookups
4. **Backward compatible** - Column is nullable, so existing projections still work

## After Migration

Once the migration is complete:

1. **Deploy the new code** that uses `cash_flow_item_id`
2. **Test** that:
   - New projections include `cash_flow_item_id` values
   - Federal tax calculations work correctly
   - Charts display correctly
   - Existing projections still work (they'll have `cash_flow_item_id = NULL`)

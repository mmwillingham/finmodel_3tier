#!/bin/bash
# Test script for account type migration
# This script creates test data and validates the migration

set -e  # Exit on error

echo "=== Account Type Migration Test ==="
echo ""

# Database connection parameters
DB_HOST="127.0.0.1"
DB_USER="bolauder"
DB_NAME="finmodel"
export PGPASSWORD="iamhe123"

# Check if PostgreSQL is running
echo "1. Checking PostgreSQL connection..."
if ! psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to PostgreSQL database"
    echo "Please ensure PostgreSQL is running and credentials are correct"
    exit 1
fi
echo "✓ Database connection successful"
echo ""

# Create test table if needed
echo "2. Checking if projections table exists..."
if ! psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM projections LIMIT 1;" > /dev/null 2>&1; then
    echo "WARNING: projections table does not exist or has no data"
    echo "Creating test projection with missing account types..."
    
    # Insert a test projection without account types
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
    -- Create a test user if not exists
    INSERT INTO users (email, hashed_password, is_active)
    VALUES ('test@example.com', 'hashed_password', true)
    ON CONFLICT (email) DO NOTHING;
    
    -- Insert test projection without type field in accounts_json
    INSERT INTO projections (owner_id, name, years, final_value, total_contributed, total_growth, data_json, accounts_json)
    SELECT 
        id,
        'Test Migration Projection',
        10,
        50000.0,
        30000.0,
        20000.0,
        '[{"Year": 1, "Value": 5000}]',
        '[{"name": "Account 1", "initial_balance": 1000, "monthly_contribution": 100, "annual_rate_percent": 5.0}, 
          {"name": "Account 2", "initial_balance": 2000, "monthly_contribution": 200, "annual_rate_percent": 7.0}]'
    FROM users
    WHERE email = 'test@example.com'
    ON CONFLICT DO NOTHING;
EOF
    echo "✓ Test data created"
else
    echo "✓ Projections table exists"
fi
echo ""

# Show before state
echo "3. Showing projections BEFORE migration:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    id, 
    name,
    substring(accounts_json, 1, 100) || '...' as accounts_json_sample
FROM projections 
ORDER BY id 
LIMIT 5;
"
echo ""

# Count projections without type field
echo "4. Counting projections that need migration..."
NEED_MIGRATION=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) 
FROM projections
WHERE accounts_json IS NOT NULL
  AND accounts_json != ''
  AND accounts_json != '[]'
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(accounts_json::JSONB) AS account
    WHERE NOT (account ? 'type')
  );
")
echo "Projections needing migration: $NEED_MIGRATION"
echo ""

# Run the migration
echo "5. Running migration..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f add_account_types_simple.sql
echo "✓ Migration completed"
echo ""

# Show after state
echo "6. Showing projections AFTER migration:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    id, 
    name,
    substring(accounts_json, 1, 150) || '...' as accounts_json_sample
FROM projections 
ORDER BY id 
LIMIT 5;
"
echo ""

# Verify all accounts now have type
echo "7. Verifying migration results..."
MISSING_TYPE=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) 
FROM projections
WHERE accounts_json IS NOT NULL
  AND accounts_json != ''
  AND accounts_json != '[]'
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(accounts_json::JSONB) AS account
    WHERE NOT (account ? 'type')
  );
")

if [ "$MISSING_TYPE" -eq 0 ]; then
    echo "✓ SUCCESS: All accounts now have a type field!"
else
    echo "✗ FAIL: $MISSING_TYPE accounts still missing type field"
    exit 1
fi
echo ""

echo "=== Migration Test Complete ==="

-- SQL script to manually delete orphaned users from the database
-- WARNING: This will permanently delete users and all their associated data
-- Run this script at your own risk and make sure you have a database backup

-- First, let's see which users exist and their associated data counts
-- Run this query first to identify users you want to delete:
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.is_active,
    u.is_confirmed,
    (SELECT COUNT(*) FROM projections WHERE owner_id = u.id) as projection_count,
    (SELECT COUNT(*) FROM assets WHERE owner_id = u.id) as asset_count,
    (SELECT COUNT(*) FROM liabilities WHERE owner_id = u.id) as liability_count,
    (SELECT COUNT(*) FROM cash_flow_items WHERE owner_id = u.id) as cashflow_count,
    (SELECT COUNT(*) FROM accounts WHERE owner_id = u.id) as account_count,
    (SELECT COUNT(*) FROM custom_charts WHERE user_id = u.id) as chart_count
FROM users u
ORDER BY u.created_at DESC;

-- To delete a specific user by ID (replace USER_ID with the actual user ID):
-- DELETE FROM users WHERE id = USER_ID;

-- To delete multiple users by ID (replace with actual IDs):
-- DELETE FROM users WHERE id IN (1, 2, 3);

-- To delete users with no associated data (orphaned users):
-- WARNING: This will delete ALL users with no data. Use with caution!
-- DELETE FROM users 
-- WHERE id NOT IN (
--     SELECT DISTINCT owner_id FROM projections
--     UNION
--     SELECT DISTINCT owner_id FROM assets
--     UNION
--     SELECT DISTINCT owner_id FROM liabilities
--     UNION
--     SELECT DISTINCT owner_id FROM cash_flow_items
--     UNION
--     SELECT DISTINCT owner_id FROM accounts
--     UNION
--     SELECT DISTINCT user_id FROM custom_charts
-- );

-- Note: Due to CASCADE constraints, deleting a user will automatically delete:
-- - All projections and their associated data
-- - All assets
-- - All liabilities
-- - All cash flow items
-- - All accounts
-- - All custom charts
-- - All auto-disbursements
-- - All user settings
-- - All password reset tokens
-- - All email confirmation tokens


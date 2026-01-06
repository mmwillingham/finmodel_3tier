# Cleaning Up Orphaned Users

If you have users in the database that were deleted from the application but remain in the database, you have two options to clean them up:

## Option 1: Using the Python Script (Recommended)

The Python script provides a safer, more interactive way to identify and delete orphaned users.

### Prerequisites
- Python 3.x
- Database connection configured (same as your API)

### Usage

1. **List all users with their data counts:**
   ```bash
   cd /home/mwilling/git/finmodel_3tier/api
   python scripts/cleanup_orphaned_users.py --list
   ```
   This will show all users and how much data each has. Users with no data are marked as "ORPHANED".

2. **Delete a specific user by ID:**
   ```bash
   python scripts/cleanup_orphaned_users.py --delete USER_ID
   ```
   Replace `USER_ID` with the actual user ID. The script will show you what data will be deleted and ask for confirmation.

3. **Dry run (see what would be deleted without actually deleting):**
   ```bash
   python scripts/cleanup_orphaned_users.py --delete USER_ID --dry-run
   ```

4. **Delete all orphaned users (users with no data):**
   ```bash
   python scripts/cleanup_orphaned_users.py --delete-orphaned
   ```
   ⚠️ **WARNING**: This will delete ALL users with no associated data. Use with extreme caution!

## Option 2: Using SQL Script (Direct Database Access)

If you prefer to work directly with the database:

1. **First, identify users to delete:**
   ```sql
   SELECT 
       u.id,
       u.email,
       u.created_at,
       (SELECT COUNT(*) FROM projections WHERE owner_id = u.id) as projection_count,
       (SELECT COUNT(*) FROM assets WHERE owner_id = u.id) as asset_count,
       (SELECT COUNT(*) FROM liabilities WHERE owner_id = u.id) as liability_count,
       (SELECT COUNT(*) FROM cash_flow_items WHERE owner_id = u.id) as cashflow_count,
       (SELECT COUNT(*) FROM accounts WHERE owner_id = u.id) as account_count,
       (SELECT COUNT(*) FROM custom_charts WHERE user_id = u.id) as chart_count
   FROM users u
   ORDER BY u.created_at DESC;
   ```

2. **Delete a specific user:**
   ```sql
   DELETE FROM users WHERE id = USER_ID;
   ```

3. **Delete multiple users:**
   ```sql
   DELETE FROM users WHERE id IN (1, 2, 3);
   ```

⚠️ **IMPORTANT NOTES:**
- Always backup your database before running delete operations
- Due to CASCADE constraints, deleting a user will automatically delete all their associated data:
  - Projections and their data
  - Assets
  - Liabilities
  - Cash flow items
  - Accounts
  - Custom charts
  - Auto-disbursements
  - User settings
  - Password reset tokens
  - Email confirmation tokens

## Recommendations

1. **Start with the list command** to see which users are orphaned
2. **Use dry-run first** to verify what would be deleted
3. **Delete users one at a time** rather than bulk deleting, unless you're absolutely certain
4. **Keep a backup** of your database before performing any deletions

## Future Prevention

The user deletion endpoint has been fixed to properly delete users. Going forward, users deleted through the admin interface should be properly removed from the database.


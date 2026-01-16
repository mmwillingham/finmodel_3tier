# Database CASCADE Behavior - User Deletion

## Summary

**Yes, it is safe to delete users using native database commands** (e.g., `DELETE FROM users WHERE id = X`). The database will automatically handle all related data through CASCADE and SET NULL foreign key constraints.

## What Happens When You Delete a User

### Tables with `ondelete="CASCADE"` (These rows are automatically DELETED)

When you delete a user, all rows in these tables that reference the user are **automatically deleted**:

1. **`password_reset_tokens`** - All password reset tokens for the user
2. **`email_confirmation_tokens`** - All email confirmation tokens for the user
3. **`projections`** - All projections owned by the user
4. **`projected_accounts`** - Automatically deleted when their parent `projection` is deleted (via `projection_id` CASCADE)
5. **`cashflow_items`** - All income/expense items owned by the user
6. **`user_settings`** - User's settings record (one-to-one relationship)
7. **`brokerages`** - All brokerages owned by the user
8. **`accounts`** - All accounts owned by the user
9. **`assets`** - All assets owned by the user
10. **`liabilities`** - All liabilities owned by the user
11. **`custom_charts`** - All custom charts owned by the user
12. **`auto_disbursements`** - All auto-disbursement rules owned by the user
13. **`referrals`** - All referrals where the user is the referrer (`referrer_id`)
14. **`document_folders`** - All document folders owned by the user (and their nested folders via recursive CASCADE)
15. **`documents`** - All documents owned by the user
16. **`authorized_users`** - All rows where the user is either the primary user (`primary_user_id`) or the authorized user (`authorized_user_id`)

### Tables with `ondelete="SET NULL"` (Foreign keys are set to NULL)

These tables have foreign keys that reference the deleted user, but the rows themselves are **NOT deleted**. Instead, the foreign key is set to `NULL`:

1. **`users.referred_by_id`** - If the deleted user was referred by someone, that someone's `referred_by_id` is set to `NULL` (self-referencing foreign key)
2. **`referrals.registered_user_id`** - If the deleted user was a registered friend from a referral, the referral record remains but `registered_user_id` is set to `NULL`

### Indirect CASCADING (Secondary effects)

Because of CASCADE relationships, deleting a user also triggers these secondary deletions:

1. **`auto_disbursements`** - When assets are deleted (because the user is deleted), any `AutoDisbursement` records that reference those assets are also deleted (via `source_asset_id` and `target_asset_id` CASCADE)

2. **`projected_accounts.cash_flow_item_id`** - When `cashflow_items` are deleted, any `ProjectedAccount` records that reference them have their `cash_flow_item_id` set to `NULL` (via `ondelete="SET NULL"`)

3. **`cashflow_items.contributes_to_asset_id`** - When assets are deleted, any cash flow items that contribute to those assets have their `contributes_to_asset_id` set to `NULL`

4. **`cashflow_items.reinvestment_account_id`** - When assets are deleted, any cash flow items that reinvest into those assets have their `reinvestment_account_id` set to `NULL`

5. **`user_settings.surplus_asset_id`** - When assets are deleted, if one was the user's surplus asset, `surplus_asset_id` is set to `NULL`

6. **`accounts.brokerage_id`** - When brokerages are deleted, any accounts linked to them have their `brokerage_id` set to `NULL`

7. **`assets.account_id`** - When accounts are deleted, any assets linked to them have their `account_id` set to `NULL`

## Example SQL

If you want to delete a user with ID 123:

```sql
DELETE FROM users WHERE id = 123;
```

This single command will automatically:
- Delete all related data (projections, assets, liabilities, cash flow items, etc.)
- Set NULL for foreign keys in other tables (referrals, etc.)
- Maintain referential integrity

## Important Notes

1. **No orphaned data**: Due to proper CASCADE constraints, no orphaned data should be left behind.

2. **Backup first**: Even though CASCADE is safe, you should still backup your database before deleting users, especially in production.

3. **Application vs. Database**: You can delete users either:
   - Through the application (if a delete endpoint exists)
   - Directly via SQL (using the command above)

   Both methods will trigger the same CASCADE behavior.

4. **Performance**: Deleting a user with lots of data (many projections, assets, etc.) may take a moment due to cascading deletes. The database will handle this atomically (all or nothing).

## Verification Query

To see what will be deleted when you delete a user, you can run this query first:

```sql
-- Replace 123 with the user ID you want to check
SELECT 
    'password_reset_tokens' as table_name, COUNT(*) as count FROM password_reset_tokens WHERE user_id = 123
UNION ALL
SELECT 'email_confirmation_tokens', COUNT(*) FROM email_confirmation_tokens WHERE user_id = 123
UNION ALL
SELECT 'projections', COUNT(*) FROM projections WHERE owner_id = 123
UNION ALL
SELECT 'cashflow_items', COUNT(*) FROM cashflow_items WHERE owner_id = 123
UNION ALL
SELECT 'assets', COUNT(*) FROM assets WHERE owner_id = 123
UNION ALL
SELECT 'liabilities', COUNT(*) FROM liabilities WHERE owner_id = 123
UNION ALL
SELECT 'custom_charts', COUNT(*) FROM custom_charts WHERE user_id = 123
UNION ALL
SELECT 'auto_disbursements', COUNT(*) FROM auto_disbursements WHERE owner_id = 123
UNION ALL
SELECT 'referrals (as referrer)', COUNT(*) FROM referrals WHERE referrer_id = 123
UNION ALL
SELECT 'documents', COUNT(*) FROM documents WHERE owner_id = 123
UNION ALL
SELECT 'authorized_users (primary)', COUNT(*) FROM authorized_users WHERE primary_user_id = 123
UNION ALL
SELECT 'authorized_users (authorized)', COUNT(*) FROM authorized_users WHERE authorized_user_id = 123;
```

# Deployment Checklist

## ✅ Pre-Deployment Verification

### Database Migration ✅
- [x] Migration `brokerages_001` created successfully
- [x] Merge migration `54886b70f774` created successfully
- [x] Migration ran successfully on local database
- [x] Brokerages table created
- [x] Accounts linked to brokerages
- [x] No migration errors

### Code Changes Ready ✅
- [x] All feature implementations complete
- [x] Points system updated (surplus asset + auto-disbursements)
- [x] Asset filtering fixed (only show own assets by default)
- [x] UI cleanup completed (Auto Transfers, Default Categories, Refer a Friend)
- [x] Settings sidebar visibility implemented
- [x] Dark mode toggle added
- [x] Brokerage grouping feature implemented (backend + frontend)
- [x] Migration handles NULL values correctly

### Files Changed
- Backend: API routes, models, schemas, migrations
- Frontend: Multiple components, settings pages, styling
- Configuration: Cloud Build, Dockerfiles, package.json

## 🚀 Deployment Steps

### 1. Commit and Push Changes
```bash
cd /home/mwilling/git/finmodel_3tier
git add .
git commit -m "feat: Add brokerage grouping, fix asset filtering, UX improvements

- Add Brokerage model and grouping feature for accounts
- Fix asset filtering to only show own assets by default
- Add points for surplus asset (50) and auto-disbursements (30 each)
- UX improvements: settings sidebar, dark mode toggle, page layouts
- Migration: Add brokerages table and link existing accounts"
git push origin main  # or your branch name
```

### 2. Cloud Build Deployment
The push will trigger Cloud Build automatically (if configured), or manually:
```bash
gcloud builds submit --config cloudbuild.yaml
```

### 3. Verify Migration Runs in Production
The Cloud Build process should run migrations automatically. Monitor:
- Cloud Build logs for migration success
- Cloud Run logs for any startup errors
- Database to verify brokerages table exists

### 4. Post-Deployment Verification
After deployment, verify:
- [ ] Backend service starts successfully
- [ ] Frontend service starts successfully
- [ ] Can log in successfully
- [ ] Accounts page shows brokerage grouping
- [ ] Can create new brokerages
- [ ] Assets only show own assets (not authorized users' assets)
- [ ] Settings sidebar is visible
- [ ] Dark mode toggle works
- [ ] Points include surplus asset and auto-disbursements

## ⚠️ Important Notes

### Database Migration
- The migration is **idempotent** - it checks `brokerage_id IS NULL` before updating
- If migration fails partway, it's safe to re-run
- Legacy fields (`brokerage`, `broker_name`, etc.) remain for backward compatibility
- Can be cleaned up in a future migration if desired

### Backward Compatibility
- Old API endpoints still work with legacy `brokerage` field
- New API supports both `brokerage_id` and `brokerage` (for creating new brokerages)
- Frontend gracefully handles both old and new data structures

### Rollback Plan
If issues arise:
1. **Backend**: Rollback to previous Cloud Run revision
2. **Database**: Migration can be downgraded with `alembic downgrade -1` (removes brokerages table)
3. **Frontend**: Rollback to previous Cloud Run revision

## 🔍 Testing Recommendations

Before deploying to production, consider:
1. Test on staging environment first (if available)
2. Test brokerage creation/editing flows
3. Test account creation with brokerage linking
4. Verify asset filtering works correctly
5. Test account switcher with brokerage grouping
6. Verify points calculation includes new categories

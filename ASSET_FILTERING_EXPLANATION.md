# Asset Filtering Explanation

## The Problem (Before Fix)

**Previous Behavior:**
When you logged into your personal account (viewingUserId = null), the system was showing:
- ✅ Your own assets
- ❌ **ALSO assets from other users who granted you access** (even though you weren't explicitly viewing their account)

This meant that in your "personal" view, you'd see a mix of your assets and other people's assets, which was confusing and not the intended behavior.

## The Fix (After)

**New Behavior:**
- **When viewingUserId is null** (your personal account view):
  - ✅ **ONLY shows YOUR OWN assets**
  - ❌ Does NOT show assets from authorized users (unless you switch to viewing their account)
  
- **When viewingUserId is set** (you've switched to view another user's account via Account Switcher):
  - ✅ Shows ONLY that specific user's assets (if you have permission)
  - ❌ Does NOT show your own assets or other users' assets

## Example Scenario

**User A has:**
- 5 assets of their own
- Granted "view" permission to User B for their assets

**User B has:**
- 3 assets of their own
- Has received "view" permission from User A

### Before Fix:
When User B logs in and views their personal account:
- Shows 3 assets (User B's own) ✅
- Shows 5 assets (User A's) ❌ **This was wrong!**

### After Fix:
When User B logs in and views their personal account:
- Shows 3 assets (User B's own) ✅
- Does NOT show User A's assets ✅

When User B uses Account Switcher to view User A's account:
- Shows 5 assets (User A's) ✅
- Does NOT show User B's own assets ✅

## Technical Implementation

The change was in `api/routers/assets.py`:

**Before:**
```python
accessible_user_ids = get_accessible_user_ids(db, current_user.id, "items")
# This always returned [current_user.id] + [any users who granted access]
# So even when viewingUserId was None, it included authorized users' IDs
```

**After:**
```python
if viewing_user_id is None:
    accessible_user_ids = [current_user.id]  # ONLY your own
else:
    accessible_user_ids = get_accessible_user_ids(...)  # Check permissions
    # Then filter to just the specific viewing_user_id
```

This ensures clean separation: your personal view shows only your data, and switching accounts shows only that account's data.

# Pre-Deploy Fixes Summary

## ✅ Completed Fixes

### 1. Asset Filtering (Issue #8)
- **Problem**: Assets from authorized users showing in personal account
- **Fix**: 
  - Backend: Modified `api/routers/assets.py` to default to only current_user.id when viewingUserId is None
  - Frontend: Updated `AutoDisbursementSettingsPage.jsx` to pass viewingUserId to AssetService.list()

### 2. Points System (Issues #1, #2)
- **Problem**: Need to add points for surplus asset and auto-disbursements
- **Fix**: 
  - Updated `api/routers/points.py` to include:
    - `surplus_asset`: 50 points if set
    - `auto_disbursements`: 30 points per auto-disbursement
  - Added these to PointsBreakdown model and calculation

### 3. Auto Transfers Page Cleanup (Issue #3) - Partial
- **Problem**: Page too tall/wide, too much white space, Surplus Asset value not fully visible
- **Fixes Applied**:
  - Reduced max-width from 1200px to 900px
  - Reduced margins and padding throughout
  - Fixed select dropdown widths (from 150px to 400px max)
  - Made form labels consistent width (140px min-width)
  - Reduced heading sizes and spacing
  - Fixed layout for date inputs with help text

## 🚧 In Progress / Remaining

### 4. Default Categories Page (Issue #4)
- **Problem**: Jumbled mess layout
- **Status**: Need to reorganize GlobalSettings component layout

### 5. Refer a Friend Page (Issue #5)
- **Problem**: Too wide, text extends outside box
- **Status**: Need to fix width constraints and text overflow

### 6. Sidebar Visibility in Settings (Issue #6)
- **Problem**: Sidebar should remain visible when in Settings
- **Status**: Need to modify App.jsx routing structure

### 7. Dark Mode (Issue #7)
- **Problem**: How to enable dark mode?
- **Status**: Need to add toggle/documentation. ThemeContext exists but no UI control

### 8. Brokerage Grouping (Issue #9)
- **Problem**: Want to group accounts under brokerages (e.g., Merrill Lynch has 6 accounts, Fidelity has 2)
- **Status**: Large feature - requires schema changes and UI updates
- **Note**: This is a significant architectural change

## Next Steps
1. Continue with Default Categories cleanup
2. Fix Refer a Friend page layout
3. Add sidebar visibility to Settings pages
4. Add dark mode toggle to UI
5. Design brokerage grouping feature (consider migration strategy)

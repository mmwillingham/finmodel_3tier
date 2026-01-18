# Plaid Integration Guide

This document describes the Plaid integration for automatically populating financial data from connected bank accounts.

## Overview

The Plaid integration allows users to connect their bank accounts via Plaid Link and automatically sync account balances as assets. The integration:

1. Creates Plaid Link tokens for users to connect accounts
2. Exchanges public tokens for access tokens (stored encrypted)
3. Syncs account data to create/update Brokerage, Account, and Asset records
4. Supports investment accounts, checking/savings, and other account types

## Backend Implementation

### Files Created/Modified

1. **`api/models.py`** - Added `PlaidItem` model
2. **`api/schemas.py`** - Added `PlaidExchangeTokenRequest` and `PlaidItemOut` schemas
3. **`api/config.py`** - Added Plaid configuration settings
4. **`api/utils/plaid_service.py`** - Plaid API service utility
5. **`api/routers/plaid.py`** - API endpoints for Plaid integration
6. **`api/requirements.txt`** - Added `plaid-python>=11.0.0`
7. **`api/main.py`** - Registered Plaid router
8. **`add_plaid_items_table.sql`** - Database migration script

### Configuration

Set the following environment variables:

```bash
# Required
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret_key
PLAID_ENV=sandbox  # or 'development' or 'production'

# Optional
PLAID_REDIRECT_URI=https://yourapp.com/plaid/oauth  # For OAuth flows
PLAID_ENCRYPTION_KEY=your_32_byte_base64_key  # For encrypting access tokens
```

### Database Migration

Run the migration script to create the `plaid_items` table:

```bash
psql -h your_host -U your_user -d your_database -f add_plaid_items_table.sql
```

### API Endpoints

#### 1. Create Link Token
```
GET /plaid/link-token
```
Returns a `link_token` for initializing Plaid Link on the frontend.

#### 2. Exchange Public Token
```
POST /plaid/exchange-public-token
Body: { "public_token": "..." }
```
Exchanges the public token from Plaid Link for an access token and stores it.

#### 3. Sync Accounts
```
POST /plaid/sync-accounts/{item_id}
```
Fetches accounts from Plaid and creates/updates:
- Brokerage records (one per institution)
- Account records (one per bank account)
- Asset records (one per account balance)

#### 4. List Plaid Items
```
GET /plaid/items
```
Returns all connected Plaid items for the current user.

#### 5. Delete Plaid Item
```
DELETE /plaid/items/{item_id}
```
Removes a Plaid connection.

## Frontend Implementation (TODO)

You'll need to:

1. **Install Plaid Link**:
   ```bash
   npm install react-plaid-link
   ```

2. **Create a Plaid Link Component** that:
   - Fetches link token from `/plaid/link-token`
   - Initializes Plaid Link with the token
   - Handles the `onSuccess` callback to exchange the public token
   - Calls `/plaid/sync-accounts/{item_id}` after successful connection
   - Displays connected accounts and allows syncing

3. **Example Component Structure**:
   ```jsx
   import { usePlaidLink } from 'react-plaid-link';
   
   function PlaidConnectButton() {
     const [linkToken, setLinkToken] = useState(null);
     
     // Fetch link token on mount
     useEffect(() => {
       fetch('/api/plaid/link-token')
         .then(res => res.json())
         .then(data => setLinkToken(data.link_token));
     }, []);
     
     const { open, ready } = usePlaidLink({
       token: linkToken,
       onSuccess: (public_token) => {
         // Exchange public token
         fetch('/api/plaid/exchange-public-token', {
           method: 'POST',
           body: JSON.stringify({ public_token })
         })
         .then(res => res.json())
         .then(data => {
           // Sync accounts
           return fetch(`/api/plaid/sync-accounts/${data.item_id}`, {
             method: 'POST'
           });
         })
         .then(() => {
           // Refresh assets list
           window.location.reload();
         });
       }
     });
     
     return (
       <button onClick={() => open()} disabled={!ready}>
         Connect Bank Account
       </button>
     );
   }
   ```

## How It Works

1. **User clicks "Connect Bank Account"** → Frontend requests link token
2. **Plaid Link opens** → User selects institution and logs in
3. **Plaid returns public_token** → Frontend sends to backend
4. **Backend exchanges token** → Gets access_token and stores it encrypted
5. **Backend syncs accounts** → Creates Brokerage, Account, and Asset records
6. **Assets appear in UI** → User can see their connected accounts as assets

## Data Mapping

### Account Types → Asset Categories
- `investment` → "Investment"
- `depository` (checking/savings) → "Cash"
- `depository` (other) → "Depository"
- `credit` → "Credit"
- Other → "Other"

### Account → Asset Mapping
- Each account balance becomes an Asset
- Asset name: `"{Account Name} - {Institution Name} ({mask})"`
- Asset value: Current balance from Plaid
- Asset start_date: Current date
- Asset category: Based on account type (see above)

### Retirement Accounts
Accounts with subtypes `ira`, `401k`, `403b`, `401a`, `457b`, `roth`, `roth 401k` are marked as `is_retirement=True` on the Account record.

## Security

- **Access tokens are encrypted** using Fernet (symmetric encryption)
- **Encryption key** should be stored securely (environment variable or key management service)
- **Tokens are never exposed** to the frontend
- **User isolation** - users can only access their own Plaid items

## Testing

### Sandbox Environment

Use Plaid's sandbox environment for testing:
- Set `PLAID_ENV=sandbox`
- Use test credentials: `user_good` / `pass_good`
- Test institutions available in Plaid Dashboard

### Test Flow

1. Get link token: `GET /plaid/link-token`
2. Use Plaid Link with sandbox credentials
3. Exchange public token: `POST /plaid/exchange-public-token`
4. Sync accounts: `POST /plaid/sync-accounts/{item_id}`
5. Verify assets created in database

## Next Steps

1. **Frontend Component** - Create React component for Plaid Link
2. **UI Integration** - Add "Connect Bank Account" button to Assets page
3. **Sync Management** - Add UI for viewing/managing connected accounts
4. **Auto-sync** - Set up webhooks or scheduled jobs for periodic syncing
5. **Error Handling** - Handle Plaid errors (ITEM_LOGIN_REQUIRED, etc.)
6. **Investment Holdings** - Expand to sync individual investment holdings as separate assets

## References

- [Plaid API Documentation](https://plaid.com/docs/api/)
- [Plaid Sandbox Guide](https://plaid.com/docs/sandbox/)
- [Plaid Python SDK](https://github.com/plaid/plaid-python)

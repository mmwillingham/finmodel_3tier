import ApiService from "./api.service";

const PlaidService = {
  // Get a link token for initializing Plaid Link
  getLinkToken: () => {
    return ApiService.get("/plaid/link-token");
  },

  // Exchange public token for access token
  exchangePublicToken: (publicToken) => {
    return ApiService.post("/plaid/exchange-public-token", {
      public_token: publicToken,
    });
  },

  // Sync accounts from a Plaid item
  syncAccounts: (itemId) => {
    return ApiService.post(`/plaid/sync-accounts/${itemId}`);
  },

  // List all connected Plaid items
  listItems: () => {
    return ApiService.get("/plaid/items");
  },

  // Delete a Plaid item
  deleteItem: (itemId) => {
    return ApiService.delete(`/plaid/items/${itemId}`);
  },
};

export default PlaidService;

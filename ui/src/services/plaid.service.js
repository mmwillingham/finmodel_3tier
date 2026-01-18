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

  // Preview accounts from a Plaid item (for mapping)
  previewAccounts: (itemId) => {
    return ApiService.get(`/plaid/preview-accounts/${itemId}`);
  },

  // Apply mappings to create assets/liabilities
  applyMappings: (itemId, mappings) => {
    return ApiService.post(`/plaid/apply-mappings/${itemId}`, {
      mappings: mappings
    });
  },
};

export default PlaidService;

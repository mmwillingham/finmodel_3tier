import ApiService from './api.service';

type MappingPayload = any;
type PlaidResponse = any;

const PlaidService = {
  getLinkToken() {
    return ApiService.get<PlaidResponse>('/plaid/link-token');
  },

  exchangePublicToken(publicToken: string) {
    return ApiService.post<PlaidResponse>('/plaid/exchange-public-token', {
      public_token: publicToken,
    });
  },

  syncAccounts(itemId: string) {
    return ApiService.post<PlaidResponse>(`/plaid/sync-accounts/${itemId}`);
  },

  listItems() {
    return ApiService.get<PlaidResponse>('/plaid/items');
  },

  deleteItem(itemId: string) {
    return ApiService.delete(`/plaid/items/${itemId}`);
  },

  previewAccounts(itemId: string) {
    return ApiService.get<PlaidResponse>(`/plaid/preview-accounts/${itemId}`);
  },

  applyMappings(itemId: string, mappings: MappingPayload) {
    return ApiService.post<PlaidResponse>(`/plaid/apply-mappings/${itemId}`, {
      mappings,
    });
  },
};

export default PlaidService;

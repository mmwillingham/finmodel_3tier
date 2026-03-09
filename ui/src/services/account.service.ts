import api from './api.service';

type AccountResponse = any;
type AccountPayload = any;

const AccountService = {
  async getAllAccounts(viewingUserId: number | null = null): Promise<AccountResponse[]> {
    try {
      const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
      const response = await api.get('/accounts/', { params });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getAccount(accountId: string): Promise<AccountResponse> {
    try {
      const response = await api.get(`/accounts/${accountId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createAccount(account: AccountPayload): Promise<AccountResponse> {
    try {
      const response = await api.post('/accounts/', account);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateAccount(accountId: string, account: AccountPayload): Promise<AccountResponse> {
    try {
      const response = await api.put(`/accounts/${accountId}`, account);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteAccount(accountId: string, cascade = false): Promise<void> {
    try {
      const params = cascade ? { cascade: 'true' } : {};
      await api.delete(`/accounts/${accountId}`, { params });
    } catch (error: any) {
      throw error;
    }
  },
};

export default AccountService;


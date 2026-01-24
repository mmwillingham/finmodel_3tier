import api from './api.service';

const AccountService = {
  async getAllAccounts(viewingUserId = null) {
    try {
      const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
      const response = await api.get('/accounts/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getAccount(accountId) {
    try {
      const response = await api.get(`/accounts/${accountId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async createAccount(account) {
    try {
      const response = await api.post('/accounts/', account);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateAccount(accountId, account) {
    try {
      const response = await api.put(`/accounts/${accountId}`, account);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteAccount(accountId, cascade = false) {
    try {
      const params = cascade ? { cascade: 'true' } : {};
      await api.delete(`/accounts/${accountId}`, { params });
    } catch (error) {
      throw error;
    }
  },
};

export default AccountService;


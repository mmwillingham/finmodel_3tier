import api from './api.service';

const AccountService = {
  async getAllAccounts(viewingUserId = null) {
    try {
      const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
      const response = await api.get('/accounts/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  },

  async getAccount(accountId) {
    try {
      const response = await api.get(`/accounts/${accountId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching account:', error);
      throw error;
    }
  },

  async createAccount(account) {
    try {
      const response = await api.post('/accounts/', account);
      return response.data;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  },

  async updateAccount(accountId, account) {
    try {
      const response = await api.put(`/accounts/${accountId}`, account);
      return response.data;
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  },

  async deleteAccount(accountId) {
    try {
      await api.delete(`/accounts/${accountId}`);
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  },
};

export default AccountService;


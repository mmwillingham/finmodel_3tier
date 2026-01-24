import api from './api.service';

const AuthorizedUsersService = {
  /**
   * Create a new authorized user
   */
  async createAuthorizedUser(data) {
    try {
      const response = await api.post('/authorized-users/', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * List all users authorized by the current user
   */
  async listAuthorizedUsers() {
    try {
      const response = await api.get('/authorized-users/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * List all primary users that have granted access to the current user
   */
  async listReceivedAccess() {
    try {
      const response = await api.get('/authorized-users/received');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get a specific authorized user
   */
  async getAuthorizedUser(authorizedUserId) {
    try {
      const response = await api.get(`/authorized-users/${authorizedUserId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update permissions for an authorized user
   */
  async updateAuthorizedUser(authorizedUserId, updates) {
    try {
      const response = await api.put(`/authorized-users/${authorizedUserId}`, updates);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete an authorized user
   */
  async deleteAuthorizedUser(authorizedUserId) {
    try {
      await api.delete(`/authorized-users/${authorizedUserId}`);
    } catch (error) {
      throw error;
    }
  }
};

export default AuthorizedUsersService;


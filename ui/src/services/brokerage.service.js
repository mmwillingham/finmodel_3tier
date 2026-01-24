import ApiService from './api.service';

const BrokerageService = {
  async getAllBrokerages(viewingUserId = null) {
    try {
      const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
      const response = await ApiService.get('/brokerages/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getBrokerage(brokerageId) {
    try {
      const response = await ApiService.get(`/brokerages/${brokerageId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async createBrokerage(brokerage) {
    try {
      const response = await ApiService.post('/brokerages/', brokerage);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateBrokerage(brokerageId, brokerage) {
    try {
      const response = await ApiService.put(`/brokerages/${brokerageId}`, brokerage);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteBrokerage(brokerageId, cascade = false, retain = false) {
    try {
      const params = {};
      if (cascade) {
        params.cascade = 'true';
      } else if (retain) {
        params.retain = 'true';
      }
      await ApiService.delete(`/brokerages/${brokerageId}`, { params });
    } catch (error) {
      throw error;
    }
  },

  async checkBrokerageUsage(brokerageId) {
    try {
      const response = await ApiService.get(`/brokerages/${brokerageId}/usage`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default BrokerageService;

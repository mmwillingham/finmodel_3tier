import ApiService from './api.service';

const BrokerageService = {
  async getAllBrokerages(viewingUserId = null) {
    try {
      const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
      const response = await ApiService.get('/brokerages/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching brokerages:', error);
      throw error;
    }
  },

  async getBrokerage(brokerageId) {
    try {
      const response = await ApiService.get(`/brokerages/${brokerageId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching brokerage:', error);
      throw error;
    }
  },

  async createBrokerage(brokerage) {
    try {
      const response = await ApiService.post('/brokerages/', brokerage);
      return response.data;
    } catch (error) {
      console.error('Error creating brokerage:', error);
      throw error;
    }
  },

  async updateBrokerage(brokerageId, brokerage) {
    try {
      const response = await ApiService.put(`/brokerages/${brokerageId}`, brokerage);
      return response.data;
    } catch (error) {
      console.error('Error updating brokerage:', error);
      throw error;
    }
  },

  async deleteBrokerage(brokerageId) {
    try {
      await ApiService.delete(`/brokerages/${brokerageId}`);
    } catch (error) {
      console.error('Error deleting brokerage:', error);
      throw error;
    }
  },
};

export default BrokerageService;

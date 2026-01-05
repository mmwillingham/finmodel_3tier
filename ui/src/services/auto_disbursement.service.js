import api from './api.service';

const AutoDisbursementService = {
  async getAllAutoDisbursements() {
    try {
      const response = await api.get('/auto-disbursements/');
      return response.data;
    } catch (error) {
      console.error('Error fetching auto-disbursements:', error);
      throw error;
    }
  },

  async getAutoDisbursement(autoDisbursementId) {
    try {
      const response = await api.get(`/auto-disbursements/${autoDisbursementId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching auto-disbursement:', error);
      throw error;
    }
  },

  async createAutoDisbursement(autoDisbursement) {
    try {
      const response = await api.post('/auto-disbursements/', autoDisbursement);
      return response.data;
    } catch (error) {
      console.error('Error creating auto-disbursement:', error);
      throw error;
    }
  },

  async updateAutoDisbursement(autoDisbursementId, autoDisbursement) {
    try {
      const response = await api.put(`/auto-disbursements/${autoDisbursementId}`, autoDisbursement);
      return response.data;
    } catch (error) {
      console.error('Error updating auto-disbursement:', error);
      throw error;
    }
  },

  async deleteAutoDisbursement(autoDisbursementId) {
    try {
      await api.delete(`/auto-disbursements/${autoDisbursementId}`);
    } catch (error) {
      console.error('Error deleting auto-disbursement:', error);
      throw error;
    }
  },
};

export default AutoDisbursementService;


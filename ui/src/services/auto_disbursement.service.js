import api from './api.service';

const AutoDisbursementService = {
  async getAllAutoDisbursements(viewingUserId = null) {
    try {
      const config = {};
      if (viewingUserId !== null && viewingUserId !== undefined) {
        config.params = { viewing_user_id: viewingUserId };
      }
      const response = await api.get('/auto-disbursements/', config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getAutoDisbursement(autoDisbursementId) {
    try {
      const response = await api.get(`/auto-disbursements/${autoDisbursementId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async createAutoDisbursement(autoDisbursement) {
    try {
      const response = await api.post('/auto-disbursements/', autoDisbursement);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateAutoDisbursement(autoDisbursementId, autoDisbursement) {
    try {
      const response = await api.put(`/auto-disbursements/${autoDisbursementId}`, autoDisbursement);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteAutoDisbursement(autoDisbursementId) {
    try {
      await api.delete(`/auto-disbursements/${autoDisbursementId}`);
    } catch (error) {
      throw error;
    }
  },
  async getRmd(assetId, year = null, years = null) {
    try {
      const params = { asset_id: assetId };
      if (year) params.year = year;
      if (years) params.years = years;
      const response = await api.get('/auto-disbursements/rmd', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default AutoDisbursementService;


import api from './api.service';

const ReferralService = {
  async createReferral(friendName, friendEmail) {
    try {
      const response = await api.post('/referrals/', {
        friend_name: friendName,
        friend_email: friendEmail
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getMyReferrals() {
    try {
      const response = await api.get('/referrals/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getReferralStats() {
    try {
      const response = await api.get('/referrals/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default ReferralService;


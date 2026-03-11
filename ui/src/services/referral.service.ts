import api from './api.service';

type ReferralPayload = {
  friend_name: string;
  friend_email: string;
};
type ReferralResponse = any;

const ReferralService = {
  async createReferral(friendName: string, friendEmail: string) {
    try {
      const response = await api.post<ReferralResponse>('/referrals/', {
        friend_name: friendName,
        friend_email: friendEmail,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getMyReferrals() {
    try {
      const response = await api.get<ReferralResponse[]>('/referrals/');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getReferralStats() {
    try {
      const response = await api.get<ReferralResponse>('/referrals/stats');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default ReferralService;


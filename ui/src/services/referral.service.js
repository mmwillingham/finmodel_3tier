import axios from 'axios';
import authHeader from './auth-header';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ReferralService {
  createReferral(friendName, friendEmail) {
    return axios.post(
      `${API_URL}/referrals/`,
      { friend_name: friendName, friend_email: friendEmail },
      { headers: authHeader() }
    );
  }

  getMyReferrals() {
    return axios.get(`${API_URL}/referrals/`, { headers: authHeader() });
  }

  getReferralStats() {
    return axios.get(`${API_URL}/referrals/stats`, { headers: authHeader() });
  }
}

export default new ReferralService();


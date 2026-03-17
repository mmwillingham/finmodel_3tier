import axios from './api.service';

const API_URL = ((process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/?$/, '/'));

const BillingService = {
  async createCheckoutSession(tier: 'premium' | 'pro') {
    const response = await axios.post(API_URL + 'billing/checkout-session', {
      tier,
    });
    return response.data;
  },
};

export default BillingService;

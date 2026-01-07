import api from './api.service';

const PointsService = {
  /**
   * Get the current user's points and breakdown
   */
  async getPoints() {
    try {
      const response = await api.get('/points/');
      return response.data;
    } catch (error) {
      console.error('Error fetching points:', error);
      throw error;
    }
  }
};

export default PointsService;


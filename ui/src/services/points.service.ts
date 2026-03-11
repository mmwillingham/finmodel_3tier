import api from './api.service';

type PointsResponse = any;

const PointsService = {
  async getPoints() {
    try {
      const response = await api.get<PointsResponse>('/points/');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  async getChecklist() {
    try {
      const response = await api.get<PointsResponse>('/points/checklist');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default PointsService;


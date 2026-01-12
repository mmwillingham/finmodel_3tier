import axios from './api.service';

const API_URL = '/custom_charts';

class CustomChartService {
  getAll(viewingUserId = null) {
    const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
    return axios.get(API_URL, { params });
  }

  get(id) {
    return axios.get(`${API_URL}/${id}`);
  }

  create(chartData) {
    return axios.post(API_URL, chartData);
  }

  update(id, chartData) {
    return axios.put(`${API_URL}/${id}`, chartData);
  }

  delete(id) {
    return axios.delete(`${API_URL}/${id}`);
  }

  recalculateAll() {
    return axios.post(`${API_URL}/recalculate-all`);
  }

  recalculate(chartId) {
    return axios.post(`${API_URL}/${chartId}/recalculate`);
  }
}

const customChartService = new CustomChartService();
export default customChartService;

import axios from './api.service';

const API_URL = '/custom_charts';

class CustomChartService {
  getAll() {
    return axios.get(API_URL);
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
}

const customChartService = new CustomChartService();
export default customChartService;

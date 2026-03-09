import axios from './api.service';

type CustomChartPayload = any;
type CustomChartResponse = any;

const API_URL = '/custom_charts';

class CustomChartService {
  getAll(viewingUserId: number | null = null) {
    const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
    return axios.get<CustomChartResponse[]>(API_URL, { params });
  }

  get(id: string) {
    return axios.get<CustomChartResponse>(`${API_URL}/${id}`);
  }

  create(chartData: CustomChartPayload) {
    return axios.post<CustomChartResponse>(API_URL, chartData);
  }

  update(id: string, chartData: CustomChartPayload) {
    return axios.put<CustomChartResponse>(`${API_URL}/${id}`, chartData);
  }

  delete(id: string) {
    return axios.delete(`${API_URL}/${id}`);
  }

  recalculateAll() {
    return axios.post(`${API_URL}/recalculate-all`);
  }

  recalculate(chartId: string) {
    return axios.post(`${API_URL}/${chartId}/recalculate`);
  }
}

const customChartService = new CustomChartService();
export default customChartService;

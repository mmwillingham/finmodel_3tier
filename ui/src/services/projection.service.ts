import ApiService from './api.service';

type ProjectionPayload = any;
type ProjectionResponse = any;

const ProjectionService = {
  async getProjections() {
    const response = await ApiService.get<ProjectionResponse[]>('/projections');
    return response.data;
  },

  async getProjectionDetails(id: string) {
    const url = `/projections/${id}`;
    const response = await ApiService.get<ProjectionResponse>(url);
    return response.data;
  },

  async createProjection(payload: ProjectionPayload) {
    const response = await ApiService.post<ProjectionResponse>('/projections', payload);
    return response.data;
  },

  async updateProjection(id: string, projectionData: ProjectionPayload) {
    const response = await ApiService.put<ProjectionResponse>(`/projections/${id}`, projectionData);
    return response.data;
  },

  async deleteProjection(id: string) {
    const response = await ApiService.delete(`/projections/${id}`);
    return response.data;
  },
};

export default ProjectionService;

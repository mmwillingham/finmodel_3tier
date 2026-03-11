import ApiService from './api.service';

type LiabilityPayload = any;
type LiabilityResponse = any;

const LiabilityService = {
  list(viewingUserId: number | null = null) {
    const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
    return ApiService.get<LiabilityResponse[]>('/liabilities/', { params });
  },

  create(data: LiabilityPayload) {
    return ApiService.post<LiabilityResponse>('/liabilities/', data);
  },

  update(id: string, data: LiabilityPayload) {
    return ApiService.put<LiabilityResponse>(`/liabilities/${id}`, data);
  },

  delete(id: string) {
    return ApiService.delete(`/liabilities/${id}`);
  },
};

export default LiabilityService;

import ApiService from './api.service';

type AssetPayload = any;
type AssetResponse = any;

const AssetService = {
  list(viewingUserId: number | null = null) {
    const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
    return ApiService.get<AssetResponse[]>('/assets/', { params });
  },

  create(data: AssetPayload) {
    return ApiService.post<AssetResponse>('/assets/', data);
  },

  update(id: string, data: AssetPayload) {
    return ApiService.put<AssetResponse>(`/assets/${id}`, data);
  },

  delete(id: number | string) {
    return ApiService.delete(`/assets/${id}`);
  },
};

export default AssetService;

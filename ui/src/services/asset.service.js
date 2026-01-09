import ApiService from "./api.service";

const AssetService = {
  list: (viewingUserId = null) => {
    const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
    return ApiService.get("/assets/", { params });
  },
  create: (data) => ApiService.post("/assets/", data),
  update: (id, data) => ApiService.put(`/assets/${id}`, data),
  delete: (id) => ApiService.delete(`/assets/${id}`),
};

export default AssetService;

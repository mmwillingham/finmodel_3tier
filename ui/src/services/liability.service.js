import ApiService from "./api.service";

const LiabilityService = {
  list: (viewingUserId = null) => {
    const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
    return ApiService.get("/liabilities/", { params });
  },
  create: (data) => ApiService.post("/liabilities/", data),
  update: (id, data) => ApiService.put(`/liabilities/${id}`, data),
  delete: (id) => ApiService.delete(`/liabilities/${id}`),
};

export default LiabilityService;

import ApiService from "./api.service";

const LiabilityService = {
  list: () => ApiService.get("/liabilities"),
  create: (data) => ApiService.post("/liabilities", data),
  update: (id, data) => ApiService.put(`/liabilities/${id}`, data),
  delete: (id) => ApiService.delete(`/liabilities/${id}`),
};

export default LiabilityService;

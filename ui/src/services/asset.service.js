import ApiService from "./api.service";

const AssetService = {
  list: () => ApiService.get("/assets"),
  create: (data) => ApiService.post("/assets", data),
  update: (id, data) => ApiService.put(`/assets/${id}`, data),
  delete: (id) => ApiService.delete(`/assets/${id}`),
};

export default AssetService;

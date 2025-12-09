import ApiService from "./api.service";

const CashFlowService = {
  list: (isIncome) => ApiService.get("/cashflow", { params: { is_income: isIncome } }),
  create: (data) => ApiService.post("/cashflow", data),
  update: (id, data) => ApiService.put(`/cashflow/${id}`, data),
  delete: (id) => ApiService.delete(`/cashflow/${id}`),
};

export default CashFlowService;
import ApiService from "./api.service";

const CashFlowService = {
  list: (isIncome, viewingUserId = null) => {
    const params = { is_income: isIncome };
    if (viewingUserId !== null && viewingUserId !== undefined) {
      params.viewing_user_id = viewingUserId;
    }
    return ApiService.get("/cashflow", { params });
  },
  create: (data) => ApiService.post("/cashflow", data),
  update: (id, data) => ApiService.put(`/cashflow/${id}`, data),
  delete: (id) => ApiService.delete(`/cashflow/${id}`),
};

export default CashFlowService;
import ApiService from './api.service';

type CashflowPayload = any;
type CashflowResponse = any;

const CashFlowService = {
  list(isIncome: boolean, viewingUserId: number | null = null) {
    const params: Record<string, number | boolean> = { is_income: isIncome };
    if (viewingUserId !== null) {
      params.viewing_user_id = viewingUserId;
    }
    return ApiService.get<CashflowResponse[]>('/cashflow', { params });
  },

  create(data: CashflowPayload) {
    return ApiService.post<CashflowResponse>('/cashflow', data);
  },

  update(id: string, data: CashflowPayload) {
    return ApiService.put<CashflowResponse>(`/cashflow/${id}`, data);
  },

  delete(id: string) {
    return ApiService.delete(`/cashflow/${id}`);
  },
};

export default CashFlowService;
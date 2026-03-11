import api from './api.service';

type AutoDisbursementPayload = any;
type AutoDisbursementResponse = any;

const AutoDisbursementService = {
  async getAllAutoDisbursements(viewingUserId: number | null = null) {
    try {
      const config = viewingUserId !== null ? { params: { viewing_user_id: viewingUserId } } : undefined;
      const response = await api.get<AutoDisbursementResponse[]>('/auto-disbursements/', config);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getAutoDisbursement(autoDisbursementId: string) {
    try {
      const response = await api.get<AutoDisbursementResponse>(`/auto-disbursements/${autoDisbursementId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createAutoDisbursement(autoDisbursement: AutoDisbursementPayload) {
    try {
      const response = await api.post<AutoDisbursementResponse>('/auto-disbursements/', autoDisbursement);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateAutoDisbursement(autoDisbursementId: string, autoDisbursement: AutoDisbursementPayload) {
    try {
      const response = await api.put<AutoDisbursementResponse>(`/auto-disbursements/${autoDisbursementId}`, autoDisbursement);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteAutoDisbursement(autoDisbursementId: string) {
    try {
      await api.delete(`/auto-disbursements/${autoDisbursementId}`);
    } catch (error: any) {
      throw error;
    }
  },

  async getRmd(assetId: string, year: number | null = null, years: number | null = null) {
    try {
      const params: Record<string, number | string> = { asset_id: Number(assetId) };
      if (year !== null) params.year = year;
      if (years !== null) params.years = years;
      const response = await api.get('/auto-disbursements/rmd', { params });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default AutoDisbursementService;


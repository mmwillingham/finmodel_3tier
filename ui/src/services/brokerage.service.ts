import ApiService from './api.service';

type BrokeragePayload = any;
type BrokerageResponse = any;

const BrokerageService = {
  async getAllBrokerages(viewingUserId: number | null = null) {
    try {
      const params = viewingUserId ? { viewing_user_id: viewingUserId } : {};
      const response = await ApiService.get<BrokerageResponse[]>('/brokerages/', { params });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getBrokerage(brokerageId: string) {
    try {
      const response = await ApiService.get<BrokerageResponse>(`/brokerages/${brokerageId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createBrokerage(brokerage: BrokeragePayload) {
    try {
      const response = await ApiService.post<BrokerageResponse>('/brokerages/', brokerage);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateBrokerage(brokerageId: string, brokerage: BrokeragePayload) {
    try {
      const response = await ApiService.put<BrokerageResponse>(`/brokerages/${brokerageId}`, brokerage);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteBrokerage(brokerageId: string, cascade = false, retain = false) {
    try {
      const params: Record<string, 'true' | undefined> = {};
      if (cascade) {
        params.cascade = 'true';
      } else if (retain) {
        params.retain = 'true';
      }
      await ApiService.delete(`/brokerages/${brokerageId}`, { params });
    } catch (error: any) {
      throw error;
    }
  },

  async checkBrokerageUsage(brokerageId: string) {
    try {
      const response = await ApiService.get<BrokerageResponse>(`/brokerages/${brokerageId}/usage`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default BrokerageService;

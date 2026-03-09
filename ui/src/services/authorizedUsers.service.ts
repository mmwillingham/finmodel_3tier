import api from './api.service';

type AuthorizedUserPayload = any;
interface AuthorizedUserResponse {
  primary_user_id?: number;
  [key: string]: unknown;
}

const AuthorizedUsersService = {
  async createAuthorizedUser(data: AuthorizedUserPayload) {
    try {
      const response = await api.post<AuthorizedUserResponse>('/authorized-users/', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async listAuthorizedUsers() {
    try {
      const response = await api.get<AuthorizedUserResponse[]>('/authorized-users/');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async listReceivedAccess() {
    try {
      const response = await api.get<AuthorizedUserResponse[]>('/authorized-users/received');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getAuthorizedUser(authorizedUserId: string) {
    try {
      const response = await api.get<AuthorizedUserResponse>(`/authorized-users/${authorizedUserId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateAuthorizedUser(authorizedUserId: string, updates: Partial<AuthorizedUserPayload>) {
    try {
      const response = await api.put<AuthorizedUserResponse>(`/authorized-users/${authorizedUserId}`, updates);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteAuthorizedUser(authorizedUserId: string) {
    try {
      await api.delete(`/authorized-users/${authorizedUserId}`);
    } catch (error: any) {
      throw error;
    }
  },
};

export default AuthorizedUsersService;


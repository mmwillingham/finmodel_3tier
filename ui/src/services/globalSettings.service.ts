import axios from './api.service';
import AuthService from './auth.service';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/?$/, '/');

type GlobalSettingsData = any;

const getGlobalSettings = async (token: string): Promise<GlobalSettingsData> => {
  try {
    const response = await axios.get<GlobalSettingsData>(`${API_URL}/admin/global-settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

const getHelpAboutContent = async (): Promise<any> => {
  try {
    const token = AuthService.getToken();
    if (!token) {
      throw new Error('Authentication token missing');
    }
    const response = await axios.get<any>(`${API_URL}content/help-about`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

const updateGlobalSettings = async (globalSettingsData: GlobalSettingsData, token: string): Promise<GlobalSettingsData> => {
  const response = await axios.put<GlobalSettingsData>(`${API_URL}/admin/global-settings`, globalSettingsData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return response.data;
};

export default {
  getGlobalSettings,
  getHelpAboutContent,
  updateGlobalSettings,
};


import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import AuthService from './auth.service';

// IMPORTANT: This MUST match your FastAPI server address/port
const API_URL = process.env.REACT_APP_API_URL;

const shieldKey =
  import.meta.env.VITE_MMR_SHIELD_KEY || process.env.REACT_APP_MMR_SHIELD_KEY || '';

const defaultHeaders: Record<string, string> = {
  'Content-type': 'application/json',
};

if (shieldKey) {
  defaultHeaders['X-MMR-Shield-Key'] = shieldKey;
}

const ApiService: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: defaultHeaders,
});

ApiService.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = AuthService.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => Promise.reject(error),
);

ApiService.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    if (error.response && error.response.status === 401) {
      AuthService.logout();
    }
    return Promise.reject(error);
  },
);

export default ApiService;
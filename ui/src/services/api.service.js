// api.service.js
import axios from "axios";

const ApiService = axios.create({
  // Use VITE_ prefix for Vite-based projects
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

ApiService.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user && user.access_token) {
      config.headers["Authorization"] = `Bearer ${user.access_token}`;
    }

    const deviceToken = localStorage.getItem("mfa_device");
    if (deviceToken) {
      config.headers["X-MFA-DEVICE"] = deviceToken;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

ApiService.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (!error.config.url.includes("/auth/mfa/verify")) {
        localStorage.removeItem("user");
        // Use a soft redirect to avoid breaking React state if possible
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default ApiService;
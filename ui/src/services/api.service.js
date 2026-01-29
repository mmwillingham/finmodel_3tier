import axios from "axios";

const ApiService = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

ApiService.interceptors.request.use(
  (config) => {
    // 1. Attach the standard JWT Access Token if it exists
    const user = JSON.parse(localStorage.getItem("user"));
    if (user && user.access_token) {
      config.headers["Authorization"] = `Bearer ${user.access_token}`;
    }

    // 2. Attach the MFA Trusted Device Token if it exists
    // This allows the backend to skip MFA for recognized devices
    const deviceToken = localStorage.getItem("mfa_device");
    if (deviceToken) {
      config.headers["X-MFA-DEVICE"] = deviceToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401 Unauthorized errors (expired tokens)
ApiService.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If the error isn't related to an MFA handshake, log the user out
      if (!error.config.url.includes("/auth/mfa/verify")) {
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default ApiService;
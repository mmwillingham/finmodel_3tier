import axios from "axios";
import AuthService from "./auth.service";

// Restore your production variable name exactly
const API_URL = process.env.REACT_APP_API_URL;

const ApiService = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-type": "application/json",
    },
});

ApiService.interceptors.request.use(
    (config) => {
        const token = AuthService.getToken();
        if (token) {
            config.headers["Authorization"] = "Bearer " + token;
        }

        // Add the MFA Trusted Device Token for the new backend functionality
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

ApiService.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            // Protect against logout loops during MFA verification
            if (!error.config.url.includes("/auth/mfa/verify")) {
                AuthService.logout();
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default ApiService;
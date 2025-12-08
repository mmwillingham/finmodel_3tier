import axios from "axios";
import AuthService from "./auth.service";

// IMPORTANT: This MUST match your FastAPI server address/port
const API_URL = "http://localhost:8000/";

// Create a custom Axios instance
const ApiService = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-type": "application/json",
    },
});

// Request Interceptor: Attach the JWT token before sending
ApiService.interceptors.request.use(
    (config) => {
        const token = AuthService.getToken();
        console.log("Interceptor Running.");
        console.log("Token retrieved:", token);
        if (token) {
            // Attach the token in the 'Authorization: Bearer <token>' format
            config.headers["Authorization"] = "Bearer " + token;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor (Optional, but good for handling 401s globally)
ApiService.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // If the server returns 401 (Unauthorized), it means the token is expired or invalid
        if (error.response && error.response.status === 401) {
            AuthService.logout();
            // Note: We can't use 'navigate' here, so we rely on AuthContext to manage redirect on state change
        }
        return Promise.reject(error);
    }
);

export default ApiService;

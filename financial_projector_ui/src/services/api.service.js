import axios from "axios";
import AuthService from "./auth.service";

const API_URL = "http://localhost:8000/";

// Create an instance of Axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor: Runs before every request is sent
api.interceptors.request.use(
  (config) => {
    const token = AuthService.getCurrentToken();

    // If a token exists, add it to the Authorization header
    if (token) {
      config.headers["Authorization"] = 'Bearer ' + token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Define your main protected API methods here ---

class ApiService {
  // POST /projections
  saveProjection(projectionData) {
    return api.post("projections", projectionData);
  }

  // GET /projections
  getProjectionsSummary() {
    return api.get("projections");
  }

  // GET /projections/{id}
  getProjectionDetails(id) {
    return api.get(`projections/${id}`);
  }

  // DELETE /projections/{id}
  deleteProjection(id) {
    return api.delete(`projections/${id}`);
  }
}

export default new ApiService();


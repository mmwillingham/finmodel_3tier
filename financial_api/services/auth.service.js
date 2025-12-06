import axios from "axios";

// Define your backend URL (change this when deploying!)
const API_URL = "http://localhost:8000/"; // Assuming FastAPI runs on port 8000

class AuthService {
    
    // --- 1. LOGIN ---
    login(email, password) {
        // FastAPI's /token endpoint expects data in the URL-encoded format,
        // which matches the standard browser FormData submission, NOT JSON.
        const data = new URLSearchParams();
        data.append('username', email); // FastAPI uses 'username' for email
        data.append('password', password);

        return axios
            .post(API_URL + "token", data)
            .then(response => {
                // If login is successful, store the JWT in local storage
                if (response.data.access_token) {
                    localStorage.setItem("user_token", JSON.stringify(response.data.access_token));
                }
                return response.data;
            });
    }

    // --- 2. LOGOUT ---
    logout() {
        // Simply remove the token from local storage
        localStorage.removeItem("user_token");
    }

    // --- 3. SIGNUP ---
    signup(email, password) {
        // FastAPI's /signup endpoint expects a JSON payload
        return axios
            .post(API_URL + "signup", {
                email,
                password
            })
            .then(response => {
                // Optionally log the user in immediately after signup
                return this.login(email, password);
            });
    }

    // --- 4. GET CURRENT TOKEN ---
    getCurrentToken() {
        // Retrieve the token for use in API headers
        const token = localStorage.getItem("user_token");
        return token ? JSON.parse(token) : null;
    }
}

export default new AuthService();

import axios from 'axios';

// IMPORTANT: This must match your FastAPI server address/port
const API_URL = "http://localhost:8000/"; 

const AuthService = {
    /**
     * Attempts to log the user in by sending credentials to FastAPI.
     * On success, saves the JWT to local storage.
     */
    async login(email, password) {
        // FastAPI's /token endpoint requires data in x-www-form-urlencoded format.
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        localStorage.removeItem("user_token"); 

        try {
            const response = await axios.post(API_URL + "token", formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (response.data.access_token) {
                // Save the token to local storage for persistence
                localStorage.setItem("user_token", response.data.access_token);
                return response.data;
            }
        } catch (error) {
            throw error;
        }
    },

    /**
     * Registers a new user via the FastAPI /signup route.
     */
    async signup(email, password) {
        const response = await axios.post(API_URL + "signup", {
            email: email,
            password: password,
        });
        return response.data;
    },

    /**
     * Clears the token from local storage.
     */
    logout() {
        localStorage.removeItem("user_token");
    },
    
    /**
     * Retrieves the stored token.
     */
    getToken() {
        return localStorage.getItem("user_token");
    },
};

export default AuthService;

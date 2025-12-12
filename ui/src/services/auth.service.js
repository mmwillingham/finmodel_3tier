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
                // After successful login, fetch user details
                const userDetails = await AuthService.getCurrentUser();
                return { token: response.data.access_token, user: userDetails };
            }
        } catch (error) {
            throw error;
        }
    },

    /**
     * Fetches the current user's details using the stored token.
     */
    async getCurrentUser() {
        const token = AuthService.getToken();
        if (!token) {
            return null;
        }
        try {
            const response = await axios.get(API_URL + "users/me", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error("Failed to fetch current user:", error);
            AuthService.logout(); // Clear token if fetching user fails
            return null;
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

    /**
     * Changes the user's password.
     */
    async changePassword(currentPassword, newPassword) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }

        const response = await axios.put(API_URL + "users/me/password", 
            {
                current_password: currentPassword,
                new_password: newPassword,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    },

    /**
     * Requests a password reset link for the given email.
     */
    async requestPasswordReset(email) {
        const response = await axios.post(API_URL + "forgot-password", {
            email: email,
        });
        return response.data;
    },

    /**
     * Resets the user's password using a valid reset token.
     */
    async resetPassword(token, newPassword) {
        const response = await axios.post(API_URL + "reset-password", {
            token: token,
            new_password: newPassword,
        });
        return response.data;
    },

    /**
     * Verifies the user's email address using a confirmation token.
     */
    async verifyEmail(token) {
        const response = await axios.post(API_URL + "verify-email", {
            token: token,
        });
        return response.data;
    },

    /**
     * Retrieves a list of all manageable users (excluding the current admin). (Admin only)
     */
    async getAllManageableUsers() {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.get(API_URL + "admin/users", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

    /**
     * Deletes a user by their ID. (Admin only)
     */
    async deleteUser(userId) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.delete(API_URL + `admin/users/${userId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

    /**
     * Updates a user's admin status. (Admin only)
     */
    async setUserAdminStatus(userId, isAdmin) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.put(API_URL + `admin/users/${userId}/set-admin-status`, 
            {
                is_admin: isAdmin,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    },
};

export default AuthService;

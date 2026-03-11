import axios from './api.service';

const API_URL = ((process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/?$/, '/'));

type Nullable<T> = T | null;

interface LoginResponse {
  mfa_required?: boolean;
  mfa_token?: string;
  mfa_methods?: string[];
  must_change_password?: boolean;
  access_token?: string;
  token?: string;
}

const AuthService = {
  async login(email: string, password: string): Promise<LoginResponse & { user?: any }> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    localStorage.removeItem('user_token');

    try {
      const mfaDeviceToken = localStorage.getItem('mfa_device_token');
      const response = await axios.post(API_URL + 'token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(mfaDeviceToken ? { 'X-MFA-DEVICE': mfaDeviceToken } : {}),
        },
      });

      if (response.data.mfa_required) {
        return {
          mfa_required: true,
          mfa_token: response.data.mfa_token,
          mfa_methods: response.data.mfa_methods || [],
          must_change_password: response.data.must_change_password || false,
        };
      }

      if (response.data.access_token) {
        AuthService.setToken(response.data.access_token);
        const userDetails = await AuthService.getCurrentUser();
        return {
          token: response.data.access_token,
          user: userDetails,
          must_change_password: response.data.must_change_password || false,
        };
      }
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getCurrentUser() {
    const token = AuthService.getToken();
    if (!token) {
      return null;
    }
    try {
      const response = await axios.get(API_URL + 'users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error: any) {
      AuthService.logout();
      return null;
    }
  },

  async signup(email: string, password: string) {
    const response = await axios.post(API_URL + 'users/', {
      email,
      password,
    });
    return response.data;
  },

  logout() {
    localStorage.removeItem('user_token');
  },

  getToken() {
    return localStorage.getItem('user_token');
  },

  setToken(token: string) {
    localStorage.setItem('user_token', token);
  },

    /**
     * Changes the user's password.
     */
  async changePassword(currentPassword: string, newPassword: string) {
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
  async requestPasswordReset(email: string) {
        const response = await axios.post(API_URL + "forgot-password", {
            email: email,
        });
        return response.data;
    },

    /**
     * Resets the user's password using a valid reset token.
     */
  async resetPassword(token: string, newPassword: string) {
        const response = await axios.post(API_URL + "reset-password", {
            token: token,
            new_password: newPassword,
        });
        return response.data;
    },

    /**
     * Verifies the user's email address using a confirmation token.
     */
  async verifyEmail(token: string) {
        const response = await axios.post(API_URL + "verify-email", {
            token: token,
        });
        return response.data;
    },

  async requestMfaOtp(mfaToken: string, method: string) {
        const response = await axios.post(API_URL + "mfa/request-otp", {
            mfa_token: mfaToken,
            method: method,
        });
        return response.data;
    },

  async verifyMfaOtp(mfaToken: string, method: string, code: string, rememberDevice = false) {
        const response = await axios.post(API_URL + "mfa/verify-otp", {
            mfa_token: mfaToken,
            method: method,
            code: code,
            remember_device: rememberDevice,
        });
        if (response.data.mfa_device_token) {
            localStorage.setItem("mfa_device_token", response.data.mfa_device_token);
        }
        if (response.data.access_token) {
            AuthService.setToken(response.data.access_token);
            const userDetails = await AuthService.getCurrentUser();
            return {
                token: response.data.access_token,
                user: userDetails,
                must_change_password: response.data.must_change_password || false
            };
        }
        return response.data;
    },

  async getMfaSettings() {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.get(API_URL + "mfa/settings", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

  async updateMfaSettings(payload: any) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.put(API_URL + "mfa/settings", payload, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

  async getPasskeyRegistrationOptions() {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.get(API_URL + "mfa/passkey/registration-options", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

  async verifyPasskeyRegistration(credential: PublicKeyCredential) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.post(API_URL + "mfa/passkey/verify-registration", {
            credential: credential,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

  async listPasskeyCredentials() {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.get(API_URL + "mfa/passkey/credentials", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

  async updatePasskeyCredential(credentialId: string, payload: any) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.patch(API_URL + `mfa/passkey/credentials/${credentialId}`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

  async deletePasskeyCredential(credentialId: string) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.delete(API_URL + `mfa/passkey/credentials/${credentialId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    },

  async getPasskeyAuthenticationOptions(mfaToken: string) {
        const response = await axios.post(API_URL + "mfa/passkey/authentication-options", {
            mfa_token: mfaToken,
        });
        return response.data;
    },

  async verifyPasskeyAuthentication(mfaToken: string, credential: PublicKeyCredential, rememberDevice = false) {
        const response = await axios.post(API_URL + "mfa/passkey/verify", {
            mfa_token: mfaToken,
            credential: credential,
            remember_device: rememberDevice,
        });
        if (response.data.mfa_device_token) {
            localStorage.setItem("mfa_device_token", response.data.mfa_device_token);
        }
        if (response.data.access_token) {
            AuthService.setToken(response.data.access_token);
            const userDetails = await AuthService.getCurrentUser();
            return {
                token: response.data.access_token,
                user: userDetails,
                must_change_password: response.data.must_change_password || false
            };
        }
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
  async deleteUser(userId: string) {
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
  async setUserAdminStatus(userId: string, isAdmin: boolean, subscriptionLevel: number | null = null) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.put(API_URL + `admin/users/${userId}/set-admin-status`, 
            {
                is_admin: isAdmin,
                subscription_level: subscriptionLevel,
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
     * Creates a new user. (Admin only)
     */
  async createUser(email: string | null, password: string, mustChangePassword = true, subscriptionLevel = 1) {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error("No authentication token found.");
        }
        const response = await axios.post(API_URL + "admin/users", 
            {
                email: email || null,
                password: password,
                must_change_password: mustChangePassword,
                subscription_level: subscriptionLevel,
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

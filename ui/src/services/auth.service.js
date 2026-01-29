import api from "./api";

const login = async (email, password) => {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);

  const response = await api.post("/token", params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  
  // If MFA is enabled, the backend returns mfa_required: true
  if (response.data.mfa_required) {
    return {
      mfaRequired: true,
      mfaToken: response.data.mfa_token,
      mfaMethods: response.data.mfa_methods,
    };
  }

  // Normal login flow
  if (response.data.access_token) {
    localStorage.setItem("user", JSON.stringify(response.data));
  }
  return response.data;
};

const verifyMfa = async (mfaToken, code, method, rememberDevice) => {
  const response = await api.post("/auth/mfa/verify", {
    mfa_token: mfaToken,
    code: code,
    method: method,
    remember_device: rememberDevice,
  });

  if (response.data.access_token) {
    localStorage.setItem("user", JSON.stringify(response.data));
    if (response.data.mfa_device_token) {
      localStorage.setItem("mfa_device", response.data.mfa_device_token);
    }
  }
  return response.data;
};

const requestMfaOtp = async (mfaToken, method) => {
  return await api.post("/auth/mfa/request", {
    mfa_token: mfaToken,
    method: method,
  });
};

const logout = () => {
  localStorage.removeItem("user");
};

const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem("user"));
};

const authService = {
  login,
  verifyMfa,
  requestMfaOtp,
  logout,
  getCurrentUser,
};

export default authService;
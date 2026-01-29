import api from "./api.service";

const login = async (email, password) => {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);

  const response = await api.post("/token", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  
  if (response.data.mfa_required) {
    return {
      mfaRequired: true,
      mfaToken: response.data.mfa_token,
      mfaMethods: response.data.mfa_methods,
    };
  }

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

// Added to support AuthContext
const getToken = () => {
  const userJson = localStorage.getItem("user");
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson);
    return user.access_token;
  } catch (e) {
    return null;
  }
};

const logout = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("mfa_device");
  localStorage.removeItem("viewingUserId");
};

const AuthService = {
  login,
  verifyMfa,
  requestMfaOtp,
  getToken,
  logout
};

export default AuthService;
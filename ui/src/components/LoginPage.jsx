import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import authService from "../services/auth.service"; 

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get('verified') === 'true') {
      setSuccessMessage("Email verified successfully! You can now log in with your new email.");
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const data = await authService.login(email, password);
      if (data.mfaRequired) {
        setMfaData(data);
        setMfaStep(true);
        await authService.requestMfaOtp(data.mfaToken, "email");
        setSuccessMessage("Verification code sent to your email.");
      } else {
        navigate("/app");
      }
    } catch (error) {
      const resMessage = error.response?.data?.detail || "Login failed. Check your credentials.";
      setMessage(resMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await authService.verifyMfa(mfaData.mfaToken, otpCode, "email", rememberDevice);
      navigate("/app");
    } catch (error) {
      setMessage("Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper" style={{ maxWidth: "400px", margin: "80px auto", padding: "30px", border: "1px solid #334155", borderRadius: "8px", backgroundColor: "#0f172a", color: "white" }}>
      
      {successMessage && (
        <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#34d399", borderRadius: "6px", textAlign: "center", fontSize: "14px" }}>
          {successMessage}
        </div>
      )}

      {!mfaStep ? (
        <>
          <form onSubmit={handleLogin}>
            <h2 style={{ textAlign: 'center', marginBottom: "20px" }}>Sign In</h2>
            <div style={{ marginBottom: "15px" }}>
              <label>Email or Username</label>
              <input 
                type="text" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                style={{ width: "100%", padding: "10px", marginTop: "5px", backgroundColor: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "4px" }}
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label>Password</label>
                <Link to="/reset-password" style={{ fontSize: "12px", color: "#60a5fa" }}>Forgot Password?</Link>
              </div>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                style={{ width: "100%", padding: "10px", marginTop: "5px", backgroundColor: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "4px" }}
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", marginTop: "15px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
              {loading ? "Checking..." : "Login"}
            </button>
          </form>

          {/* Restored Google Button */}
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <div style={{ margin: "10px 0", color: "#94a3b8", fontSize: "12px" }}>OR</div>
            <button 
              type="button" 
              onClick={() => window.location.href = `${(process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/?$/, '/')}auth/google`} 
              disabled={loading} 
              className="google-signin-button"
              style={{ width: "100%", padding: "10px", backgroundColor: "white", color: "#333", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
            >
              Sign in with Google
            </button>
          </div>
          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#94a3b8" }}>
            Don't have an account? <Link to="/signup" style={{ color: "#60a5fa" }}>Sign up</Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleMfaVerify}>
          <h2 style={{ textAlign: 'center' }}>Security Code</h2>
          <div style={{ marginBottom: "15px" }}>
            <input 
              type="text" 
              placeholder="000000"
              value={otpCode} 
              onChange={(e) => setOtpCode(e.target.value)} 
              required 
              maxLength="6"
              style={{ width: "100%", padding: "12px", textAlign: "center", fontSize: "1.5rem", letterSpacing: "4px", backgroundColor: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "4px" }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", backgroundColor: "#059669", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
            {loading ? "Verifying..." : "Verify Identity"}
          </button>
          <button type="button" onClick={() => setMfaStep(false)} style={{ width: "100%", marginTop: "15px", background: "none", border: "none", color: "#60a5fa", cursor: "pointer" }}>
            Back to Login
          </button>
        </form>
      )}
      {message && <div style={{ marginTop: "15px", color: "#f87171", textAlign: "center" }}>{message}</div>}
    </div>
  );
};

export default LoginPage;
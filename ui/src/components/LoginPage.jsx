import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import authService from "../services/auth.service"; 

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // MFA States
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Detect if user was redirected here after successful email verification
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
    <div className="login-page-wrapper" style={{ maxWidth: "400px", margin: "80px auto", padding: "30px", border: "1px solid #334155", borderRadius: "8px", backgroundColor: "#0f172a", color: "white", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)" }}>
      
      {successMessage && (
        <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#34d399", borderRadius: "6px", textAlign: "center", fontSize: "14px" }}>
          {successMessage}
        </div>
      )}

      {!mfaStep ? (
        <form onSubmit={handleLogin}>
          <h2 style={{ textAlign: 'center', marginBottom: "20px", fontSize: "1.5rem", fontWeight: "bold" }}>Sign In</h2>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ fontSize: "14px", color: "#94a3b8" }}>Email or Username</label>
            <input 
              type="text" 
              className="form-control"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: "100%", padding: "10px", marginTop: "5px", backgroundColor: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "4px" }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "14px", color: "#94a3b8" }}>Password</label>
              <Link to="/reset-password" style={{ fontSize: "12px", color: "#60a5fa", textDecoration: "none" }}>Forgot Password?</Link>
            </div>
            <input 
              type="password" 
              className="form-control"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: "100%", padding: "10px", marginTop: "5px", backgroundColor: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "4px" }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", padding: "12px", marginTop: "15px", cursor: "pointer", backgroundColor: "#2563eb", border: "none", color: "white", borderRadius: "4px", fontWeight: "bold" }}>
            {loading ? "Checking..." : "Login"}
          </button>
          
          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#94a3b8" }}>
            Don't have an account? <Link to="/signup" style={{ color: "#60a5fa", textDecoration: "none" }}>Sign up</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleMfaVerify}>
          <h2 style={{ textAlign: 'center', fontWeight: "bold" }}>Security Code</h2>
          <p style={{ fontSize: "14px", textAlign: 'center', color: "#94a3b8", marginBottom: "20px" }}>Enter the 6-digit code sent to your email.</p>
          
          <div style={{ marginBottom: "15px" }}>
            <input 
              type="text" 
              className="form-control"
              placeholder="000000"
              value={otpCode} 
              onChange={(e) => setOtpCode(e.target.value)} 
              required 
              maxLength="6"
              style={{ width: "100%", padding: "12px", textAlign: "center", fontSize: "1.5rem", letterSpacing: "4px", backgroundColor: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "4px" }}
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: "14px", color: "#94a3b8" }}>
              <input 
                type="checkbox" 
                checked={rememberDevice} 
                onChange={(e) => setRememberDevice(e.target.checked)} 
                style={{ marginRight: "10px" }}
              />
              Remember this device
            </label>
          </div>
          <button type="submit" className="btn-success" disabled={loading} style={{ width: "100%", padding: "12px", cursor: "pointer", backgroundColor: "#059669", border: "none", color: "white", borderRadius: "4px", fontWeight: "bold" }}>
            {loading ? "Verifying..." : "Verify Identity"}
          </button>
          <button 
            type="button" 
            onClick={() => setMfaStep(false)} 
            style={{ width: "100%", marginTop: "15px", background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "14px" }}
          >
            Back to Login
          </button>
        </form>
      )}
      
      {message && (
        <div style={{ marginTop: "15px", color: "#f87171", textAlign: "center", fontWeight: "bold", fontSize: "14px" }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default LoginPage;
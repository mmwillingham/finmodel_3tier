import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/auth.service"; 

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  // MFA States
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const data = await authService.login(email, password);
      
      if (data.mfaRequired) {
        // Switch UI to MFA Mode
        setMfaData(data);
        setMfaStep(true);
        // Backend logic triggers the OTP email automatically
        await authService.requestMfaOtp(data.mfaToken, "email");
        setMessage("Verification code sent to your email.");
      } else {
        // Direct login if MFA is not enabled
        navigate("/dashboard");
        window.location.reload();
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
      navigate("/dashboard");
      window.location.reload();
    } catch (error) {
      setMessage("Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper" style={{ maxWidth: "400px", margin: "80px auto", padding: "30px", border: "1px solid #ddd", borderRadius: "8px" }}>
      {!mfaStep ? (
        <form onSubmit={handleLogin}>
          <h2 style={{ textAlign: 'center' }}>Sign In</h2>
          <div style={{ marginBottom: "15px" }}>
            <label>Email</label>
            <input 
              type="email" 
              className="form-control"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: "100%", padding: "10px", marginTop: "5px" }}
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label>Password</label>
            <input 
              type="password" 
              className="form-control"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: "100%", padding: "10px", marginTop: "5px" }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", padding: "12px", cursor: "pointer" }}>
            {loading ? "Checking..." : "Login"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMfaVerify}>
          <h2 style={{ textAlign: 'center' }}>Security Code</h2>
          <p style={{ fontSize: "14px", textAlign: 'center' }}>Enter the 6-digit code sent to your email.</p>
          
          <div style={{ marginBottom: "15px" }}>
            <input 
              type="text" 
              className="form-control"
              placeholder="000000"
              value={otpCode} 
              onChange={(e) => setOtpCode(e.target.value)} 
              required 
              maxLength="6"
              style={{ width: "100%", padding: "12px", textAlign: "center", fontSize: "1.5rem", letterSpacing: "4px" }}
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input 
                type="checkbox" 
                checked={rememberDevice} 
                onChange={(e) => setRememberDevice(e.target.checked)} 
                style={{ marginRight: "10px" }}
              />
              Remember this device
            </label>
          </div>
          <button type="submit" className="btn-success" disabled={loading} style={{ width: "100%", padding: "12px", cursor: "pointer" }}>
            {loading ? "Verifying..." : "Verify Identity"}
          </button>
          <button 
            type="button" 
            onClick={() => setMfaStep(false)} 
            style={{ width: "100%", marginTop: "15px", background: "none", border: "none", color: "blue", cursor: "pointer" }}
          >
            Cancel
          </button>
        </form>
      )}
      {message && (
        <div style={{ marginTop: "15px", color: "red", textAlign: "center", fontWeight: "bold" }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default LoginPage;
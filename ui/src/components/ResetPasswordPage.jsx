import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthService from '../services/auth.service';
import './ResetPasswordPage.css';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tokenFromUrl = queryParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      setMessage("Invalid or missing password reset token.");
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (!token) {
      setMessage("Missing password reset token.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMessage("New password and confirmation do not match.");
      setLoading(false);
      return;
    }

    try {
      await AuthService.resetPassword(token, newPassword);
      setMessage("Password has been reset successfully! Redirecting to login...");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      let displayMessage = "Failed to reset password. Please try again.";

      if (error.response && error.response.data) {
        if (typeof error.response.data.detail === 'string') {
          displayMessage = `Failed to reset password: ${error.response.data.detail}`;
        } else if (Array.isArray(error.response.data.detail)) {
          const errorDetails = error.response.data.detail.map(err => err.msg).join('; ');
          displayMessage = `Failed to reset password: ${errorDetails}`;
        } else if (error.response.data.detail) {
          displayMessage = `Failed to reset password: ${JSON.stringify(error.response.data.detail)}`;
        } else {
          displayMessage = `Failed to reset password: ${JSON.stringify(error.response.data)}`;
        }
      } else if (error.message) {
        displayMessage = `Failed to reset password: ${error.message}`;
      } else {
        displayMessage = `Failed to reset password: ${JSON.stringify(error)}`;
      }
      setMessage(displayMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-container">
      <h2>Reset Password</h2>
      {message && <p className="message">{message}</p>}

      {!token && !message.startsWith("Invalid or missing") && (
        <p className="info-message">Loading token...</p>
      )}

      {token && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-password">New Password:</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-new-password">Confirm New Password:</label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading}>Reset Password</button>
          </div>
        </form>
      )}
    </div>
  );
}
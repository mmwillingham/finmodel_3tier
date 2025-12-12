import React, { useState } from 'react';
import AuthService from '../services/auth.service';
import './ForgotPasswordModal.css';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await AuthService.requestPasswordReset(email);
      setMessage("If an account with that email exists, a password reset link has been sent.");
      setEmail("");
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error("Error requesting password reset:", error.response?.data?.detail || error.message);
      setMessage(error.response?.data?.detail || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="forgot-password-modal-overlay" onClick={onClose}>
      <div className="forgot-password-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Forgot Password</h2>
        {message && <p className="message">{message}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Enter your email address:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading}>Request Reset Link</button>
            <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

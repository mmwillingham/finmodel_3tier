import React, { useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import AuthService from '../services/auth.service';
import './ResetPasswordPage.css';

export default function ResetPasswordPage() {
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);
    try {
      await AuthService.requestPasswordReset(email);
      setMessage('If that email exists, a reset link has been sent.');
      setEmail('');
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.response?.data?.detail || error?.message || 'Unable to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);
    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage('Passwords do not match.');
      setLoading(false);
      return;
    }
    try {
      await AuthService.resetPassword(token, newPassword);
      setMessage('Password reset successful. You can now log in.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.response?.data?.detail || error?.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page-container">
      <div className="auth-card-wrapper">
        <h2>{!token ? 'Forgot Password' : 'Reset Password'}</h2>
        <p>
          {!token 
            ? 'Enter your email to receive a secure reset link.' 
            : 'Please enter and confirm your new password below.'}
        </p>
  
        {message && (
          <div className={`message-banner ${isError ? 'error-message' : 'success-message'}`}>
            {message}
          </div>
        )}
  
        {!token ? (
          <form key="request-form" onSubmit={handleRequestReset} className="auth-form">
            <div className="form-group">
              <label htmlFor="reset-email">Email Address</label>
              <input
                id="reset-email"
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@company.com"
              />
            </div>
            <button className="submit-button" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <form key="reset-form" onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                className="auth-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                id="confirm-password"
                className="auth-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <button className="submit-button" type="submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
  
        <Link to="/login" className="back-link">
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
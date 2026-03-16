import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
    <div className="reset-password-container">
      <h2>Reset Password</h2>
      {message && (
        <div className={`message ${isError ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
      {!token ? (
        <form onSubmit={handleRequestReset}>
          <div className="form-group">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              name="reset-email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword}>
          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              name="new-password"
              autoComplete="off"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              name="confirm-password"
              autoComplete="off"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
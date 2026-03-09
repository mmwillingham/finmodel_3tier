import React, { useState, useEffect } from 'react';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import './ChangePasswordModal.css';

export default function ChangePasswordModal({ isOpen, onClose, requireChange = false }: any) {
  const { currentUser, login } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (newPassword !== confirmNewPassword) {
      setMessage("New password and confirmation do not match.");
      setLoading(false);
      return;
    }

    try {
      await AuthService.changePassword(currentPassword, newPassword);
      setMessage("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      // After password change, refresh user data to get updated must_change_password flag
      // Refresh the AuthContext to get the updated user data
      setTimeout(async () => {
        try {
          // Refresh user data in AuthContext
          await login();
          // Give it a moment for state to update, then check
          setTimeout(async () => {
            const updatedUser = await AuthService.getCurrentUser();
            // Only close if password change was not required, or if the flag is now cleared
            if (!requireChange || (updatedUser && !updatedUser.must_change_password)) {
              onClose();
            }
          }, 500);
        } catch (error: any) {
          // If we can't check, still close the modal
          onClose();
        }
      }, 1500);
    } catch (error: any) {
      let displayMessage = "Failed to change password. Please try again.";
      if (error.response && error.response.data) {
        if (typeof error.response.data.detail === 'string') {
          displayMessage = `Failed to change password: ${error.response.data.detail}`;
        } else if (Array.isArray(error.response.data.detail)) {
          const errorDetails = error.response.data.detail.map((err: any) => err.msg).join('; ');
          displayMessage = `Failed to change password: ${errorDetails}`;
        } else if (error.response.data.detail) {
          displayMessage = `Failed to change password: ${JSON.stringify(error.response.data.detail)}`;
        } else {
          displayMessage = `Failed to change password: ${JSON.stringify(error.response.data)}`;
        }
      } else if (error.message) {
        displayMessage = `Failed to change password: ${error.message}`;
      } else {
        displayMessage = `Failed to change password: ${JSON.stringify(error)}`;
      }
      setMessage(displayMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // If password change is required, don't allow closing by clicking overlay
  const handleOverlayClick = requireChange ? undefined : onClose;

  return (
    <div className="change-password-modal-overlay" onClick={handleOverlayClick}>
      <div className="change-password-modal" onClick={(e: any) => e.stopPropagation()}>
        <h2>{requireChange ? 'Change Password Required' : 'Change Password'}</h2>
        {requireChange && (
          <p style={{ color: '#d9534f', marginBottom: '15px' }}>
            You must change your password before continuing.
          </p>
        )}
        {message && <div className="message">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="current-password">Current Password:</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e: any) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New Password:</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e: any) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-new-password">Confirm New Password:</label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmNewPassword}
              onChange={(e: any) => setConfirmNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading}>Change Password</button>
            {!requireChange && (
              <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
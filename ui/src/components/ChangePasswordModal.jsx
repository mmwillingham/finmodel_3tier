import React, { useState } from 'react';
import AuthService from '../services/auth.service';
import './ChangePasswordModal.css';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
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
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      let displayMessage = "Failed to change password. Please try again.";
      if (error.response && error.response.data) {
        if (typeof error.response.data.detail === 'string') {
          displayMessage = `Failed to change password: ${error.response.data.detail}`;
        } else if (Array.isArray(error.response.data.detail)) {
          const errorDetails = error.response.data.detail.map(err => err.msg).join('; ');
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

  return (
    <div className="change-password-modal-overlay" onClick={onClose}>
      <div className="change-password-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Change Password</h2>
        {message && <div className="message">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="current-password">Current Password:</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New Password:</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
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
            />
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading}>Change Password</button>
            <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
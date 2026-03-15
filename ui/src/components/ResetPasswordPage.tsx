import React from 'react';
import AuthService from '../services/auth.service';
import './ResetPasswordPage.css';

export default function ResetPasswordPage() {
  const handleOpenBetterAuth = () => {
    try {
      AuthService.startHostedLogin();
    } catch (error: any) {
      console.error('Better Auth not configured', error);
    }
  };

  return (
    <div className="reset-password-container">
      <h2>Reset Password</h2>
      <p className="info-message">
        Password reset and email verification are handled by Better Auth.
        Click below to open the hosted experience and follow the instructions.
      </p>
      <button type="button" onClick={handleOpenBetterAuth}>
        Open Better Auth
      </button>
    </div>
  );
}
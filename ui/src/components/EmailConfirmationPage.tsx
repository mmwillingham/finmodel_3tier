import React from 'react';
import AuthService from '../services/auth.service';
import './EmailConfirmationPage.css';

export default function EmailConfirmationPage() {
  const handleOpenBetterAuth = () => {
    try {
      AuthService.startHostedLogin();
    } catch (error: any) {
      console.error('Better Auth not configured', error);
    }
  };

  return (
    <div className="email-confirmation-container">
      <h2>Email Confirmation</h2>
      <p className="info-message">
        Email confirmation is issued through Better Auth&apos;s hosted experience. Please reopen the hosted UI and follow the instructions sent to your inbox.
      </p>
      <button type="button" onClick={handleOpenBetterAuth}>Open Better Auth</button>
    </div>
  );
}

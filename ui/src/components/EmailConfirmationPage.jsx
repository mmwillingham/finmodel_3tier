import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import './EmailConfirmationPage.css';

export default function EmailConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your email...");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const token = queryParams.get('token');

    if (token) {
      AuthService.verifyEmail(token)
        .then(response => {
          setMessage("Email confirmed successfully! You can now log in.");
          setIsSuccess(true);
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        })
        .catch(error => {
          console.error("Email confirmation failed:", error.response?.data?.detail || error.message);
          setMessage(error.response?.data?.detail || "Failed to confirm email. The link may be invalid or expired.");
          setIsSuccess(false);
        });
    } else {
      setMessage("No confirmation token found. Please check your email for the correct link.");
      setIsSuccess(false);
    }
  }, [location, navigate]);

  return (
    <div className="email-confirmation-container">
      <h2>Email Confirmation</h2>
      <p className={isSuccess ? "success-message" : "error-message"}>{message}</p>
    </div>
  );
}

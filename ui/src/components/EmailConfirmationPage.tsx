import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthService from '../services/auth.service';
import './EmailConfirmationPage.css';

export default function EmailConfirmationPage() {
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const [message, setMessage] = useState('Checking confirmation token...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const confirm = async () => {
      if (!token) {
        setIsError(true);
        setMessage('Missing confirmation token.');
        return;
      }
      try {
        await AuthService.verifyEmail(token);
        setIsError(false);
        setMessage('Your email has been confirmed. You can now log in.');
      } catch (error: any) {
        setIsError(true);
        setMessage(error?.response?.data?.detail || error?.message || 'Unable to confirm email.');
      }
    };
    confirm();
  }, [token]);

  return (
    <div className="email-confirmation-container">
      <h2>Email Confirmation</h2>
      <p className={isError ? 'error-message' : 'success-message'}>{message}</p>
      <p>
        <Link to="/login">Go to login</Link>
      </p>
    </div>
  );
}

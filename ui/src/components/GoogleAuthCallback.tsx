import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthService from '../services/auth.service';

export default function GoogleAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [statusMessage, setStatusMessage] = useState('Signing you in with Google...');

  useEffect(() => {
    const finalizeGoogleLogin = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams((location.hash || '').replace(/^#/, ''));
        const token = params.get('token') || hashParams.get('token') || hashParams.get('access_token');
        if (!token) {
          throw new Error('Missing Google auth token.');
        }
        AuthService.setToken(token);
        await login();
        navigate('/app', { replace: true });
      } catch (error: any) {
        setStatusMessage(error?.message || 'Google sign-in failed. Redirecting to login...');
        setTimeout(() => {
          navigate('/login', {
            replace: true,
            state: { error: error?.message || 'Google sign-in failed.' },
          });
        }, 1200);
      }
    };

    finalizeGoogleLogin();
  }, [location.search, location.hash, login, navigate]);

  return (
    <div className="auth-container">
      <div className="auth-form-container">
        <h2>{statusMessage}</h2>
      </div>
    </div>
  );
}

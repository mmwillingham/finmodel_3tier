import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const processCallback = async () => {
            try {
                await AuthService.handleHostedCallback(location.search);
                await login();
                navigate('/app');
            } catch (error: any) {
                const message = error?.message || 'Authentication failed.';
                navigate('/login', { state: { error: message } });
            }
        };

        processCallback();
    }, [location.search, login, navigate]);

    return (
        <div className="auth-container">
            <h2>Signing you in...</h2>
            <p>Please wait while we finalize your Better Auth session.</p>
        </div>
    );
}

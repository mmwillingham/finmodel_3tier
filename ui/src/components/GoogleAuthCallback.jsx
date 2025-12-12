import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';

export default function GoogleAuthCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(location.search);
            const token = params.get('token');
            const error = params.get('error');

            if (error) {
                console.error("Google OAuth error:", error);
                // Redirect to login with an error message
                navigate('/login', { state: { error: `Google login failed: ${error}` } });
                return;
            }

            if (token) {
                try {
                    // Store the JWT token received from our backend
                    AuthService.setToken(token);
                    // Update AuthContext state and navigate to dashboard
                    await login();
                    navigate('/'); // Redirect to dashboard
                } catch (e) {
                    console.error("Failed to process Google login token:", e);
                    navigate('/login', { state: { error: 'Failed to log in after Google authentication.' } });
                }
            } else {
                console.error("No token received from Google OAuth callback.");
                navigate('/login', { state: { error: 'Google login callback did not return a token.' } });
            }
        };

        handleCallback();
    }, [location, navigate, login]);

    return (
        <div className="auth-container">
            <h2>Processing Google Login...</h2>
            <p>Please wait while we log you in.</p>
        </div>
    );
}

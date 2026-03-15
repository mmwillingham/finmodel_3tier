import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import '../styles/AuthForms.css';

const LoginPage = () => {
    const [error, setError] = useState<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (location.state && location.state.error) {
            setError(location.state.error);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    const handleHostedLogin = () => {
        setError(null);
        try {
            AuthService.startHostedLogin();
        } catch (err: any) {
            setError(err.message || 'Better Auth is not configured.');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form-container">
                <h2>Log In</h2>
                {error && <p className="error-message">{error}</p>}
                <p className="info-message">
                    Authentication now happens through Better Auth&apos;s hosted experience. Click the button below to continue.
                </p>
                <button type="button" className="submit-button" onClick={handleHostedLogin}>
                    Sign in with Better Auth
                </button>
                <p className="auth-switch">
                    Need an account? <Link to="/signup">Create one</Link> via Better Auth.
                </p>
            </div>
        </div>
    );
};

export default LoginPage;

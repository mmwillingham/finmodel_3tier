import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthService from '../services/auth.service';
import '../styles/AuthForms.css';

const SignupPage = () => {
    const [error, setError] = useState<string | null>(null);

    const handleHostedSignup = () => {
        setError(null);
        try {
            AuthService.startHostedLogin();
        } catch (err: any) {
            setError(err.message || 'Better Auth is not configured for sign up.');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form-container">
                <h2>Create Account</h2>
                {error && <p className="error-message">{error}</p>}
                <p className="info-message">
                    Account creation is managed by Better Auth&apos;s hosted experience. Click below to launch the sign-up flow.
                </p>
                <button type="button" className="submit-button" onClick={handleHostedSignup}>
                    Open Better Auth sign-up
                </button>
                <p className="auth-switch">
                    Already have an account? <Link to="/login">Log in here</Link>
                </p>
            </div>
        </div>
    );
};

export default SignupPage;

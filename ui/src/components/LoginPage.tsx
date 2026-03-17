import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import '../styles/AuthForms.css';

const API_URL = ((process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/?$/, '/'));

const LoginPage = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const location = useLocation() as any;
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const response = await AuthService.login(email, password);
            await login();
            navigate('/app', {
                state: { mustChangePassword: Boolean(response?.must_change_password) },
            });
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (err.message || 'Login failed.'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        const callbackUrl = `${window.location.origin}/auth/google/callback`;
        window.location.href = `${API_URL}auth/google?callback_url=${encodeURIComponent(callbackUrl)}`;
    };

    return (
        <div className="auth-container">
            <div className="auth-form-container">
                <h2>Log In</h2>
                {location?.state?.error && <p className="error-message">{location.state.error}</p>}
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>
                <button type="button" className="submit-button" onClick={handleGoogleLogin}>
                    Continue with Google
                </button>
                <p className="auth-switch">
                    Need an account? <Link to="/signup">Create one</Link>
                </p>
                <p className="auth-switch">
                    <Link to="/reset-password">Forgot your password?</Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;

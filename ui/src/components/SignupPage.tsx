import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthService from '../services/auth.service';
import '../styles/AuthForms.css';

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await AuthService.signup(email, password);
            setSuccess('Account created. Please check your email to confirm your account before logging in.');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (err.message || 'Sign up failed.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form-container">
                <h2>Create Account</h2>
                {success && <p className="success-message">{success}</p>}
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSignup}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirm-password">Confirm Password</label>
                        <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>
                <p className="auth-switch">
                    Already have an account? <Link to="/login">Log in here</Link>
                </p>
            </div>
        </div>
    );
};

export default SignupPage;

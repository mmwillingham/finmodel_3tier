import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthService from '../services/auth.service';
import '../styles/AuthForms.css'; // Import new styling

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: any) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email.trim())) {
            setMessage('Please enter a valid email address.');
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setMessage('Passwords do not match.');
            setLoading(false);
            return;
        }

        try {
            // Attempt signup, which includes a POST to /signup
            await AuthService.signup(email, password);
            
            // If successful, navigate to login page
            setMessage('Registration successful! Please check your email to confirm your account and activate login.');
            // No immediate redirect, user needs to confirm email first
            // setTimeout(() => navigate('/login'), 1000);
        } catch (error: any) {
            let displayMessage = 'Registration failed. Please try again.';

            if (error.response && error.response.data) {
                if (typeof error.response.data.detail === 'string') {
                    displayMessage = `Registration failed: ${error.response.data.detail}`;
                } else if (Array.isArray(error.response.data.detail)) {
                    const errorDetails = error.response.data.detail.map((err: any) => err.msg).join('; ');
                    displayMessage = `Registration failed: ${errorDetails}`;
                } else if (error.response.data.detail) {
                    // If detail is an object but not an array or string, stringify it
                    displayMessage = `Registration failed: ${JSON.stringify(error.response.data.detail)}`;
                } else {
                    // If response.data exists but detail is missing, stringify data
                    displayMessage = `Registration failed: ${JSON.stringify(error.response.data)}`;
                }
            } else if (error.message) {
                // Fallback for network errors or other JS errors
                displayMessage = `Registration failed: ${error.message}`;
            } else {
                // Final fallback if error object is completely unexpected
                displayMessage = `Registration failed: ${JSON.stringify(error)}`;
            }
            
            setMessage(displayMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form-container">
                <h2>Create Account</h2>
                <form onSubmit={handleSignup} className="auth-form">
                    {message && (
                        <p className={message.includes('successful') ? 'success-message' : 'error-message'}>
                            {message}
                        </p>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e: any) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="Enter your email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e: any) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm-password">Confirm Password</label>
                        <input
                            type="password"
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={(e: any) => setConfirmPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" disabled={loading} className="submit-button">
                        {loading ? 'Signing Up...' : 'Sign Up'}
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

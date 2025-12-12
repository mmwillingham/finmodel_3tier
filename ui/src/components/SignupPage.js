import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

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
        } catch (error) {
            let displayMessage = 'Registration failed. Please try again.';

            if (error.response && error.response.data) {
                if (typeof error.response.data.detail === 'string') {
                    displayMessage = `Registration failed: ${error.response.data.detail}`;
                } else if (Array.isArray(error.response.data.detail)) {
                    const errorDetails = error.response.data.detail.map(err => err.msg).join('; ');
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
            <h2>Create Your Account</h2>
            <form onSubmit={handleSignup} className="auth-form">
                {message && <p className={message.includes('successful') ? 'success-message' : 'error-message'}>{message}</p>}

                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="confirm-password">Confirm Password:</label>
                    <input
                        type="password"
                        id="confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                <button type="submit" disabled={loading} className="submit-button">
                    {loading ? 'Signing Up...' : 'Sign Up'}
                </button>
            </form>
        </div>
    );
};

export default SignupPage;

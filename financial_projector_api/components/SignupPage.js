import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSignup = (e) => {
        e.preventDefault();
        setMessage('');

        // 1. Attempt signup, which includes a POST to /signup
        AuthService.signup(email, password)
            .then(
                () => {
                    // 2. If successful (and optionally auto-logged in by authService), navigate
                    setMessage('Registration successful! Redirecting...');
                    setTimeout(() => navigate('/'), 1000); // Navigate to main page after delay
                },
                (error) => {
                    // 3. Handle errors (e.g., Email already registered)
                    const resMessage =
                        (error.response &&
                            error.response.data &&
                            error.response.data.detail) ||
                        error.message ||
                        error.toString();

                    setMessage(`Registration failed: ${resMessage}`);
                }
            );
    };

    return (
        <div className="auth-form-container">
            <h2>Create Your Account</h2>
            <form onSubmit={handleSignup}>
                <label htmlFor="email">Email:</label>
                <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <label htmlFor="password">Password:</label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit">Sign Up</button>
                {message && <div className="info-message">{message}</div>}
            </form>
        </div>
    );
};

export default SignupPage;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        setMessage('');

        // 1. Reset message and attempt login
        AuthService.login(email, password)
            .then(
                () => {
                    // 2. On success, navigate to the main dashboard/calculator page
                    navigate('/');
                    window.location.reload(); // Force a refresh to load app state
                },
                (error) => {
                    // 3. Handle errors from the API (e.g., 401 Unauthorized)
                    const resMessage =
                        (error.response &&
                            error.response.data &&
                            error.response.data.detail) ||
                        error.message ||
                        error.toString();
                    
                    if (resMessage.includes("401")) {
                        setMessage("Invalid email or password.");
                    } else {
                        setMessage(`Login failed: ${resMessage}`);
                    }
                }
            );
    };

    return (
        <div className="auth-form-container">
            <h2>Log In to Your Projector</h2>
            <form onSubmit={handleLogin}>
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

                <button type="submit">Log In</button>
                {message && <div className="error-message">{message}</div>}
            </form>
        </div>
    );
};

export default LoginPage;

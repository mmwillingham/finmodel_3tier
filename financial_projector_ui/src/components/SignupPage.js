import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        try {
            // Attempt signup, which includes a POST to /signup
            await AuthService.signup(email, password);
            
            // If successful, navigate to login page
            setMessage('Registration successful! Redirecting to login...');
            setTimeout(() => navigate('/login'), 1000);
        } catch (error) {
            // Handle errors (e.g., Email already registered)
            const errorMessage = 
                (error.response && error.response.data && error.response.data.detail) ||
                error.message ||
                'Registration failed. Please try again.';
            
            setMessage(`Registration failed: ${errorMessage}`);
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

                <button type="submit" disabled={loading} className="submit-button">
                    {loading ? 'Signing Up...' : 'Sign Up'}
                </button>
            </form>
        </div>
    );
};

export default SignupPage;

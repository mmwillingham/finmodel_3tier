import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import ForgotPasswordModal from './ForgotPasswordModal';
import '../styles/AuthForms.css'; // Import new styling

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false); // New state

    const navigate = useNavigate();
    const location = useLocation(); // NEW: Get location object

    // NEW: Check for error message from navigation state
    React.useEffect(() => {
        if (location.state && location.state.error) {
            setError(location.state.error);
            // Clear the error from state so it doesn't persist on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);
    // Get the login function from the global authentication context
    const { login, currentUser, logout } = useAuth(); // Destructure currentUser and logout

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // Basic client-side validation
        if (!email || !password) {
            setError("Please enter both email and password.");
            setLoading(false);
            return;
        }

        try {
            // 1. Call the backend API service to get the JWT token
            await AuthService.login(email, password);

            // 2. If the API call succeeds (200 OK), update the global authentication state
            //    The login() function will retrieve and verify the token.
            await login();

            // Check if the user's email is confirmed
            if (currentUser && !currentUser.is_confirmed) {
                logout(); // Log out the user to clear the token
                setError("Your email address has not been confirmed. Please check your inbox for a confirmation link.");
                setLoading(false);
                return;
            }
            
            // 3. Redirect the user to the main application page
            navigate('/');
        } catch (err) {
            console.error("Login failed:", err);
            
            // Handle specific network or API error messages
            let errorMessage = "Login failed: Network Error or server issue.";
            if (err.response && err.response.data && err.response.data.detail) {
                // Use the error message from the FastAPI backend (e.g., "Invalid credentials")
                errorMessage = `Login failed: ${err.response.data.detail}`;
            } else if (err.message === "Network Error") {
                errorMessage = "Login failed: Could not connect to the API server (Is it running?).";
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <h2>Log In</h2>
            <form onSubmit={handleSubmit} className="auth-form">
                {error && <p className="error-message">{error}</p>}

                <div className="form-group">
                    <label htmlFor="email">Email Address</label>
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
                    <label htmlFor="password">Password</label>
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
                    {loading ? 'Logging In...' : 'Log In'}
                </button>
                <button 
                    type="button" 
                    onClick={() => window.location.href = 'http://localhost:8000/auth/google'} 
                    disabled={loading} 
                    className="google-signin-button">
                    Sign in with Google
                </button>
            </form>
            <p className="auth-switch">
                <a href="#" onClick={() => setIsForgotPasswordModalOpen(true)}>Forgot Password?</a>
            </p>
            <p className="auth-switch">
                Don't have an account? <Link to="/signup">Sign Up here</Link>
            </p>

            <ForgotPasswordModal
                isOpen={isForgotPasswordModalOpen}
                onClose={() => setIsForgotPasswordModalOpen(false)}
            />
        </div>
    );
};

export default LoginPage;

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
    const { login, currentUser, logout } = useAuth(); // Destructure login, currentUser, and logout

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // Basic client-side validation
        if (!email || !password) {
            setError("Please enter both user name and password.");
            setLoading(false);
            return;
        }

        try {
            // 1. Call the backend API service to get the JWT token
            const loginResponse = await AuthService.login(email, password);

            // 2. If the API call succeeds (200 OK), update the global authentication state
            //    The login() function will retrieve and verify the token.
            await login();

            // Get the user data from the login response (more reliable than waiting for context state)
            const userData = loginResponse.user || currentUser;

            // Check if the user's email is confirmed (only if they have an email)
            if (userData && userData.email && !userData.is_confirmed) {
                logout(); // Log out the user to clear the token
                setError("Your email address has not been confirmed. Please check your inbox for a confirmation link.");
                setLoading(false);
                return;
            }
            
            // Check if password change is required (check both response flag and user data)
            // The backend returns must_change_password in the token response
            if (loginResponse.must_change_password === true || (userData && userData.must_change_password === true)) {
                // Show password change modal - redirect to home with flag
                navigate('/', { state: { mustChangePassword: true } });
                setLoading(false);
                return;
            }
            
            // Redirect the user to the main application page upon successful login
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
            } else if (err.message) { // Catch errors thrown from AuthContext (e.g., email not confirmed)
                errorMessage = `Login failed: ${err.message}`;
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form-container"> {/* NEW wrapper for vertical stacking */}
                <h2>Log In</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <p className="error-message">{error}</p>}

                    <div className="form-group">
                        <label htmlFor="email">User name</label>
                        <input
                            type="text"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="Enter your user name or email"
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
                        onClick={() => window.location.href = `${(process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/?$/, '/')}auth/google`} // Use REACT_APP_API_URL with fallback and trailing slash
                        disabled={loading} 
                        className="google-signin-button">
                        Sign in with Google
                    </button>
                </form>
                <p className="auth-switch">
                    <button type="button" onClick={() => setIsForgotPasswordModalOpen(true)} className="link-button">Forgot Password?</button>
                </p>
                <p className="auth-switch">
                    Don't have an account? <Link to="/signup">Sign Up here</Link>
                </p>
            </div>

            <ForgotPasswordModal
                isOpen={isForgotPasswordModalOpen}
                onClose={() => setIsForgotPasswordModalOpen(false)}
            />
        </div>
    );
};

export default LoginPage;

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Header = () => {
    // 1. Get the current user and logout function from the AuthContext
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        // 2. Call the logout function provided by AuthProvider
        logout();
        // 3. Redirect to the login page after logging out
        navigate('/login');
    };

    return (
        <header className="app-header">
            <nav>
                <div className="logo">
                    <Link to="/">💰 Financial Projector</Link>
                </div>
                <div className="nav-links">
                    {/* Conditional rendering: Show links only if the user is logged in */}
                    {currentUser ? (
                        <>
                            <Link to="/">Calculator</Link>
                            <Link to="/dashboard">Dashboard</Link>
                            
                            {/* Display user email and the logout button */}
                            <span className="user-info">
                                Logged in as: <strong>{currentUser.email}</strong>
                            </span>
                            <button onClick={handleLogout} className="logout-button">
                                Logout
                            </button>
                        </>
                    ) : (
                        // Show login/signup links if the user is not logged in
                        <>
                            <Link to="/login">Login</Link>
                            <Link to="/signup">Sign Up</Link>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
};

export default Header;
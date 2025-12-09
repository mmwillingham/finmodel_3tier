import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Header = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="app-header">
            <nav>
                <div className="logo">
                    <Link to="/">💰 Financial Projector</Link>
                </div>
                <div className="nav-links">
                    {currentUser ? (
                        <>
                            <button onClick={handleLogout} className="logout-button">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login">Login</Link>
                            <Link to="/signup">Sign Up</Link>
                        </>
                    )}
                </div>
                {currentUser && (
                    <div className="user-info">
                        Logged in as: <strong>{currentUser.email}</strong>
                    </div>
                )}
            </nav>
        </header>
    );
};

export default Header;
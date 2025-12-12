import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css'; // NEW: Import Header-specific CSS

const Header = ({ setIsSettingsModalOpen }) => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenSettings = () => {
        setIsSettingsModalOpen(true);
    };

    return (
        <header className="app-header">
            <nav>
                <div className="logo">
                    <Link to="/">💰 Financial Projector</Link>
                </div>
                <div className="nav-links">
                    {currentUser ? (
                        <div className="header-right-menu">
                            <div className="user-info">
                                Logged in as: <strong>{currentUser.email}</strong>
                            </div>
                            <button onClick={handleLogout} className="logout-button">
                                Logout
                            </button>
                            <div className="hamburger-menu" onClick={handleOpenSettings}>
                                <div className="bar"></div>
                                <div className="bar"></div>
                                <div className="bar"></div>
                            </div>
                        </div>
                    ) : (
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
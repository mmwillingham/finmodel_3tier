import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css'; // NEW: Import Header-specific CSS
import SettingsDropdownMenu from './SettingsDropdownMenu'; // New component for the dropdown menu

const Header = () => { // Removed setIsSettingsModalOpen prop
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false); // State to manage dropdown visibility
    
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleDropdown = () => {
        setShowDropdown(prev => !prev);
    };

    // Placeholder for handling navigation to different settings sections
    const handleNavigation = (path) => {
        navigate(path);
        setShowDropdown(false); // Close dropdown after navigation
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
                            <div className="hamburger-menu" onClick={toggleDropdown}>
                                <div className="bar"></div>
                                <div className="bar"></div>
                                <div className="bar"></div>
                                {showDropdown && (
                                    <SettingsDropdownMenu 
                                        currentUser={currentUser} 
                                        onSelect={handleNavigation} 
                                        onClose={() => setShowDropdown(false)}
                                    />
                                )}
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

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import './Header.css'; // NEW: Import Header-specific CSS
import SettingsDropdownMenu from './SettingsDropdownMenu'; // New component for the dropdown menu
import PointsModal from './PointsModal'; // Points modal component
import AboutModal from './AboutModal'; // About modal component
import AccountSwitcher from './AccountSwitcher'; // Account switcher component

const Header = () => { // Removed setIsSettingsModalOpen prop
    const { currentUser, logout, viewingUserId } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false); // State to manage dropdown visibility
    const [showPointsModal, setShowPointsModal] = useState(false); // State for points modal
    const [showAboutModal, setShowAboutModal] = useState(false); // State for about modal
    
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleDropdown = () => {
        setShowDropdown(prev => !prev);
    };

    // Placeholder for handling navigation to different settings sections
    const handleNavigation = (path) => {
        console.log(`Navigating to: ${path}`); // Debug log
        
        // Handle About modal separately - don't navigate, just show modal
        if (path === '/settings/about') {
            setShowAboutModal(true);
            setShowDropdown(false); // Close dropdown
            return;
        }
        
        // Pass state to indicate we're coming from home for back button handling
        navigate(path, { state: { from: '/' } });
        setShowDropdown(false); // Close dropdown after navigation
    };

    const handleLogoClick = () => {
        // Dispatch event to notify SidebarLayout to reset to home view
        window.dispatchEvent(new CustomEvent('navigateToHome'));
    };

    return (
        <header className="app-header">
            <nav>
                <div className="logo">
                    <Link to="/" onClick={handleLogoClick}>
                        <img src="/vault-logo.jpg" alt="" style={{ height: '32px', verticalAlign: 'middle', marginRight: '8px' }} onError={(e) => { e.target.src = '/vault-logo.png'; }} />
                        <span>Estate Springboard</span>
                    </Link>
                </div>
                <div className="nav-links">
                    {currentUser ? (
                        <div className="header-right-menu">
                            <div className="user-info">
                                Logged in as: <strong>{currentUser.email}</strong>
                            </div>
                            {viewingUserId && (
                                <div style={{ marginLeft: '16px' }}>
                                    <AccountSwitcher compact={true} />
                                </div>
                            )}
                            <button
                                onClick={toggleTheme}
                                className="theme-toggle-button"
                                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            >
                                {isDarkMode ? '☀️' : '🌙'}
                            </button>
                            <button 
                                onClick={() => setShowPointsModal(true)} 
                                className="points-button"
                                title="View Points"
                            >
                                ⭐
                            </button>
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
            <PointsModal 
                isOpen={showPointsModal} 
                onClose={() => setShowPointsModal(false)} 
            />
            <AboutModal 
                isOpen={showAboutModal} 
                onClose={() => setShowAboutModal(false)} 
            />
        </header>
    );
};

export default Header;

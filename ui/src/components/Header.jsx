import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './Header.css'; // NEW: Import Header-specific CSS
import SettingsDropdownMenu from './SettingsDropdownMenu'; // New component for the dropdown menu
import PointsModal from './PointsModal'; // Points modal component
import AboutModal from './AboutModal'; // About modal component
import HelpModal from './HelpModal'; // Help modal component
import AccountSwitcher from './AccountSwitcher'; // Account switcher component

const Header = () => { // Removed setIsSettingsModalOpen prop
    const { currentUser, logout, viewingUserId } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showDropdown, setShowDropdown] = useState(false); // State to manage dropdown visibility
    const [showPointsModal, setShowPointsModal] = useState(false); // State for points modal
    const [showAboutModal, setShowAboutModal] = useState(false); // State for about modal
    const [showHelpModal, setShowHelpModal] = useState(false); // State for help modal

    // Handle direct navigation to /settings/help or /settings/about
    useEffect(() => {
        if (location.pathname === '/settings/help') {
            setShowHelpModal(true);
        } else if (location.pathname === '/settings/about') {
            setShowAboutModal(true);
        }
    }, [location.pathname]);
    
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleDropdown = () => {
        setShowDropdown(prev => !prev);
    };

    const toggleSidebar = () => {
        window.dispatchEvent(new CustomEvent('sidebar:toggle'));
    };

    // Placeholder for handling navigation to different settings sections
    const handleNavigation = (path) => {
        
        // Handle About and Help modals separately - don't navigate, just show modal
        if (path === '/settings/about') {
            setShowAboutModal(true);
            setShowDropdown(false); // Close dropdown
            return;
        }
        if (path === '/settings/help') {
            setShowHelpModal(true);
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
                <button
                    className="mobile-menu-button"
                    onClick={toggleSidebar}
                    aria-label="Toggle navigation menu"
                    type="button"
                >
                    <span className="mobile-menu-label">Menu</span>
                </button>
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
                                <div className="account-switcher-wrapper" style={{ marginLeft: '16px' }}>
                                    <AccountSwitcher compact={true} />
                                </div>
                            )}
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
                onClose={() => {
                    setShowAboutModal(false);
                    // Navigate away from /settings/about if we're on that route
                    if (location.pathname === '/settings/about') {
                        navigate('/', { replace: true });
                    }
                }} 
            />
            <HelpModal 
                isOpen={showHelpModal} 
                onClose={() => {
                    setShowHelpModal(false);
                    // Navigate away from /settings/help if we're on that route
                    if (location.pathname === '/settings/help') {
                        navigate('/', { replace: true });
                    }
                }} 
            />
        </header>
    );
};

export default Header;

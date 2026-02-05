import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './Header.css'; // NEW: Import Header-specific CSS
import SettingsDropdownMenu from './SettingsDropdownMenu'; // New component for the dropdown menu
import PointsModal from './PointsModal'; // Points modal component
import ChecklistModal from './ChecklistModal';
import AboutModal from './AboutModal'; // About modal component
import HelpModal from './HelpModal'; // Help modal component
import AccountSwitcher from './AccountSwitcher'; // Account switcher component
import ContactFormModal from './ContactFormModal';

const Header = () => { // Removed setIsSettingsModalOpen prop
    const { currentUser, logout, viewingUserId } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showDropdown, setShowDropdown] = useState(false); // State to manage dropdown visibility
    const [showContactMenu, setShowContactMenu] = useState(false);
    const [showPointsModal, setShowPointsModal] = useState(false); // State for points modal
    const [showChecklistModal, setShowChecklistModal] = useState(false);
    const [showAboutModal, setShowAboutModal] = useState(false); // State for about modal
    const [showHelpModal, setShowHelpModal] = useState(false); // State for help modal
    const [contactModal, setContactModal] = useState({ isOpen: false, contactType: '', label: '' });

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

    const toggleContactMenu = () => {
        setShowContactMenu(prev => !prev);
    };

    const openContactModal = (contactType, label) => {
        setContactModal({ isOpen: true, contactType, label });
        setShowContactMenu(false);
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
                    <Link to={currentUser ? "/app" : "/"} onClick={handleLogoClick}>
                        <img src="/vault-logo.jpg" alt="" style={{ height: '32px', verticalAlign: 'middle', marginRight: '8px' }} onError={(e) => { e.target.src = '/vault-logo.png'; }} />
                        <span>Model My Retirement</span>
                    </Link>
                </div>
                <div className="nav-links">
                    <div className="contact-menu" onMouseLeave={() => setShowContactMenu(false)}>
                        <button type="button" className="contact-menu-button" onClick={toggleContactMenu}>
                            Contact Us
                        </button>
                        {showContactMenu && (
                            <div className="contact-menu-dropdown">
                                <button type="button" onClick={() => openContactModal('question', 'Ask a question')}>Ask a question</button>
                                <button type="button" onClick={() => openContactModal('feature', 'Request a feature')}>Request a feature</button>
                                <button type="button" onClick={() => openContactModal('bug', 'Report a bug')}>Report a bug</button>
                                <button type="button" onClick={() => openContactModal('support', 'Support')}>Support</button>
                            </div>
                        )}
                    </div>
                    {currentUser ? (
                        <div className="header-right-menu">
                            <div className="header-public-links">
                                <Link to="/features">Features</Link>
                                <Link to="/pricing">Pricing</Link>
                            </div>
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
                            <button
                                onClick={() => setShowChecklistModal(true)}
                                className="checklist-button"
                                title="View Checklist"
                            >
                                ✅
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
                                        onLogout={handleLogout}
                                    />
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <Link to="/features">Features</Link>
                            <Link to="/pricing">Pricing</Link>
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
            <ChecklistModal
                isOpen={showChecklistModal}
                onClose={() => setShowChecklistModal(false)}
            />
            <AboutModal 
                isOpen={showAboutModal} 
                onClose={() => {
                    setShowAboutModal(false);
                    // Navigate away from /settings/about if we're on that route
                    if (location.pathname === '/settings/about') {
                        navigate('/app', { replace: true });
                    }
                }} 
            />
            <HelpModal 
                isOpen={showHelpModal} 
                onClose={() => {
                    setShowHelpModal(false);
                    // Navigate away from /settings/help if we're on that route
                    if (location.pathname === '/settings/help') {
                        navigate('/app', { replace: true });
                    }
                }} 
            />
            <ContactFormModal
                isOpen={contactModal.isOpen}
                contactType={contactModal.contactType}
                label={contactModal.label}
                onClose={() => setContactModal({ isOpen: false, contactType: '', label: '' })}
            />
        </header>
    );
};

export default Header;

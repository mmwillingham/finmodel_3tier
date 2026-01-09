import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const MainLayout = () => {
    const location = useLocation();
    
    // Determine which page is active for highlighting
    const isCalculator = location.pathname === '/';
    const isMyProjections = location.pathname === '/my-projections';

    return (
        <div className="main-layout">
            {/* Left Pane: Navigation */}
            <div className="left-pane-nav">
                <nav className="main-nav">
                    <Link 
                        to="/" 
                        className={`nav-link ${isCalculator ? 'active' : ''}`}
                    >
                        Calculator
                    </Link>
                    <Link 
                        to="/my-projections" 
                        className={`nav-link ${isMyProjections ? 'active' : ''}`}
                    >
                        My Projections
                    </Link>
                </nav>
            </div>

            {/* Right Pane: Content */}
            <div className="right-pane-content">
                <Outlet />
            </div>
        </div>
    );
};

export default MainLayout;

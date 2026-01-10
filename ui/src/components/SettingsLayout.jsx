import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './SettingsLayout.css';
import './SidebarLayout.css';

/**
 * SettingsPageLayout - Wraps settings pages with a visible sidebar for navigation.
 * Provides a simplified sidebar navigation for settings pages.
 */
const SettingsPageLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { viewingUserId, currentUser } = useAuth();
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e) => {
    if (!sidebarRef.current) return;
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarRef.current.offsetWidth;
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + deltaX;
      if (newWidth >= 150 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  // Check if current route is a settings route
  const isSettingsRoute = location.pathname.startsWith('/settings') || location.pathname === '/documents';

  return (
    <div className="settings-layout-wrapper">
      {isSettingsRoute && (
        <aside className="sidebar settings-sidebar" ref={sidebarRef} style={{ width: `${sidebarWidth}px` }}>
          <div 
            className="sidebar-resize-handle"
            onMouseDown={handleMouseDown}
          />
          <nav className="sidebar-nav">
            <section className="nav-section">
              <h3>Navigation</h3>
              <button 
                className={`nav-btn ${location.pathname === '/' ? 'active' : ''}`} 
                onClick={() => navigate('/')}
              >
                Home
              </button>
              {/* Only show Documents button when NOT on a settings page */}
              {!location.pathname.startsWith('/settings') && (
                <button 
                  className={`nav-btn ${location.pathname === '/documents' ? 'active' : ''}`} 
                  onClick={() => navigate('/documents')}
                >
                  📁 Documents
                </button>
              )}
            </section>
            <section className="nav-section">
              <h3>Settings</h3>
              <button 
                className={`nav-btn ${location.pathname === '/settings/account-switcher' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/account-switcher')}
              >
                Switch Account
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/profile' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/profile')}
              >
                Profile
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/accounts' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/accounts')}
              >
                Accounts
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/categories' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/categories')}
              >
                Categories
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/auto-disbursements' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/auto-disbursements')}
              >
                Auto Transfers
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/authorized-users' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/authorized-users')}
              >
                Authorized Users
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/export-import' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/export-import')}
              >
                Export/Import
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/refer-a-friend' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/refer-a-friend')}
              >
                Refer a Friend
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/application' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/application')}
              >
                Application
              </button>
              <button 
                className={`nav-btn ${location.pathname === '/settings/help' ? 'active' : ''}`} 
                onClick={() => navigate('/settings/help')}
              >
                Help
              </button>
              {/* Admin-only items */}
              {currentUser && currentUser.is_admin && (
                <>
                  <button 
                    className={`nav-btn ${location.pathname === '/settings/admin/users' ? 'active' : ''}`} 
                    onClick={() => navigate('/settings/admin/users')}
                  >
                    User Management (Admin)
                  </button>
                  <button 
                    className={`nav-btn ${location.pathname === '/settings/admin/global-categories' ? 'active' : ''}`} 
                    onClick={() => navigate('/settings/admin/global-categories')}
                  >
                    Default Categories (Admin)
                  </button>
                </>
              )}
            </section>
          </nav>
        </aside>
      )}
      <div className="settings-content-wrapper">
        {children}
      </div>
    </div>
  );
};

export default SettingsPageLayout;

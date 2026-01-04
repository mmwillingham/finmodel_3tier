import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import GlobalSettings from '../components/GlobalSettings';
import { useNavigate } from 'react-router-dom';
import './SettingsPages.css'; // General CSS for settings pages

const DefaultCategoriesPage = () => {
  const { currentUser, refreshUserSettings } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser || !currentUser.is_admin) {
      // Redirect non-admins or unauthenticated users
      navigate('/'); // Redirect to home
    }
    // Fix browser back button - replace history entry so back goes to home
    window.history.replaceState(null, '', window.location.pathname);
  }, [currentUser, navigate]);

  useEffect(() => {
    // Intercept browser back button
    const handlePopState = (e) => {
      navigate('/', { replace: true });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  if (!currentUser || !currentUser.is_admin) {
    return <div className="access-denied-message">Access Denied: You must be an administrator to view this page.</div>; // Should ideally redirect before this is shown
  }

  return (
    <div className="settings-page-container">
      <GlobalSettings onGlobalSettingsSaved={refreshUserSettings} />
      <div className="settings-page-actions">
        <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
      </div>
    </div>
  );
};

export default DefaultCategoriesPage;

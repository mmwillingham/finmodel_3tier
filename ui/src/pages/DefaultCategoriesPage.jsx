import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import GlobalSettings from '../components/GlobalSettings';
import { useNavigate } from 'react-router-dom';
import { Button } from "@mui/material";
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import { projectionSecondaryButtonSx } from "../utils/projectionUiStyles";
import './SettingsPages.css'; // General CSS for settings pages

const DefaultCategoriesPage = () => {
  const { currentUser, refreshUserSettings } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation

  useEffect(() => {
    if (!currentUser || !currentUser.is_admin) {
      // Redirect non-admins or unauthenticated users
      navigate('/app'); // Redirect to home
    }
  }, [currentUser, navigate]);

  if (!currentUser || !currentUser.is_admin) {
    return <div className="access-denied-message">Access Denied: You must be an administrator to view this page.</div>; // Should ideally redirect before this is shown
  }

  return (
    <div className="settings-page-container">
      <GlobalSettings onGlobalSettingsSaved={refreshUserSettings} />
      <div className="settings-page-actions">
        <Button onClick={() => navigate('/app')} variant="outlined" sx={projectionSecondaryButtonSx}>Cancel</Button>
      </div>
    </div>
  );
};

export default DefaultCategoriesPage;

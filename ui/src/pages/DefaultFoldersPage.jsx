import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@mui/material";
import { useAuth } from '../context/AuthContext';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import { projectionSecondaryButtonSx } from "../utils/projectionUiStyles";
import GlobalDefaultFolders from '../components/GlobalDefaultFolders';
import './SettingsPages.css';

const DefaultFoldersPage = () => {
  const { currentUser, refreshUserSettings } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton();

  useEffect(() => {
    if (!currentUser || !currentUser.is_admin) {
      navigate('/app');
    }
  }, [currentUser, navigate]);

  if (!currentUser || !currentUser.is_admin) {
    return <div className="access-denied-message">Access Denied: Administrators only.</div>;
  }

  return (
    <div className="settings-page-container">
      <GlobalDefaultFolders onGlobalSettingsSaved={refreshUserSettings} />
      <div className="settings-page-actions">
        <Button onClick={() => navigate('/app')} variant="outlined" sx={projectionSecondaryButtonSx}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default DefaultFoldersPage;

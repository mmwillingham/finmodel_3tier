import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import globalSettingsService from '../services/globalSettings.service';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages
import AuthService from '../services/auth.service';

const AboutPage = () => {
  const { currentUser } = useAuth();
  useSettingsBackButton(); // Fix browser back button navigation
  const [aboutContent, setAboutContent] = useState('Loading about content...');
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAboutContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use public endpoint for reading (requires authentication, not admin)
      const content = await globalSettingsService.getHelpAboutContent();
      setAboutContent(content.about_content || '<h1>About</h1><p>This is a placeholder for about content. Administrators can edit this content.</p>');
    } catch (err) {
      console.error('Failed to fetch about content:', err);
      setError('Failed to load about content.');
      setAboutContent('<h1>About</h1><p>This is a placeholder for about content. Administrators can edit this content.</p>'); // Fallback content
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAboutContent();
  }, [fetchAboutContent]);

  const handleSave = async () => {
    setMessage('');
    try {
      const currentToken = AuthService.getToken();
      if (!currentToken) {
        setError('Authentication token missing. Please log in again.');
        return;
      }
      const currentGlobalSettings = await globalSettingsService.getGlobalSettings(currentToken);
      await globalSettingsService.updateGlobalSettings({ ...currentGlobalSettings, about_content: aboutContent }, currentToken);
      setMessage('About content saved successfully!');
      setIsEditing(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save about content:', err);
      setMessage('Failed to save about content.');
    }
  };

  if (loading) {
    return <div className="loading-message">Loading about content...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <div className="settings-page-container">
      <h2>About</h2>
      {message && <div className="message">{message}</div>}
      
      {currentUser && currentUser.is_admin && (
        <div className="help-admin-controls">
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)}>Edit About Content</button>
          ) : (
            <>
              <button onClick={handleSave}>Save</button>
              <button onClick={() => {
                  setIsEditing(false);
                  fetchAboutContent(); // Revert changes
              }}>Cancel</button>
            </>
          )}
        </div>
      )}

      <div className="help-content-display">
        {isEditing ? (
          <textarea
            value={aboutContent}
            onChange={(e) => setAboutContent(e.target.value)}
            rows="20"
            style={{ width: '100%', padding: '10px', minHeight: '300px' }}
          />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: aboutContent }} />
        )}
      </div>
    </div>
  );
};

export default AboutPage;

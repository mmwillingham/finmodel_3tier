import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import globalSettingsService from '../services/globalSettings.service';
import './SettingsPages.css'; // General CSS for settings pages

const HelpPage = () => {
  const { currentUser, token } = useAuth();
  const [helpContent, setHelpContent] = useState('Loading help content...');
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHelpContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await globalSettingsService.getGlobalSettings(token);
      setHelpContent(settings.help_content || '<h1>Welcome to the Help Page!</h1><p>This is a placeholder for help content. Administrators can edit this content.</p>');
    } catch (err) {
      console.error('Failed to fetch help content:', err);
      setError('Failed to load help content.');
      setHelpContent('<h1>Welcome to the Help Page!</h1><p>This is a placeholder for help content. Administrators can edit this content.</p>'); // Fallback content
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHelpContent();
  }, [fetchHelpContent]);

  const handleSave = async () => {
    setMessage('');
    try {
      const currentGlobalSettings = await globalSettingsService.getGlobalSettings(token);
      await globalSettingsService.updateGlobalSettings({ ...currentGlobalSettings, help_content: helpContent }, token);
      setMessage('Help content saved successfully!');
      setIsEditing(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save help content:', err);
      setMessage('Failed to save help content.');
    }
  };

  if (loading) {
    return <div className="loading-message">Loading help content...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <div className="settings-page-container">
      <h2>Help</h2>
      {message && <div className="message">{message}</div>}
      
      {currentUser && currentUser.is_admin && (
        <div className="help-admin-controls">
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)}>Edit Help Content</button>
          ) : (
            <>
              <button onClick={handleSave}>Save</button>
              <button onClick={() => {
                  setIsEditing(false);
                  fetchHelpContent(); // Revert changes
              }}>Cancel</button>
            </>
          )}
        </div>
      )}

      <div className="help-content-display">
        {isEditing ? (
          <textarea
            value={helpContent}
            onChange={(e) => setHelpContent(e.target.value)}
            rows="20"
            style={{ width: '100%', padding: '10px', minHeight: '300px' }}
          />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: helpContent }} />
        )}
      </div>
    </div>
  );
};

export default HelpPage;

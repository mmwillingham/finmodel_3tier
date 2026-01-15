import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import globalSettingsService from '../services/globalSettings.service';
import './AboutModal.css';
import AuthService from '../services/auth.service';

const AboutModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
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
    if (isOpen) {
      fetchAboutContent();
      setIsEditing(false); // Reset editing state when modal opens
    }
  }, [isOpen, fetchAboutContent]);

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

  if (!isOpen) return null;

  return (
    <div className="about-modal-overlay" onClick={onClose}>
      <div className="about-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="about-modal-header">
          <h2>About</h2>
          <button className="about-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="about-modal-body">
          {message && <div className="about-message">{message}</div>}
          {error && <div className="about-error">{error}</div>}
          
          {currentUser && currentUser.is_admin && (
            <div className="about-admin-controls">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)}>Edit About Content</button>
              ) : (
                <>
                  <button onClick={handleSave} className="save-button">Save</button>
                  <button onClick={() => {
                      setIsEditing(false);
                      fetchAboutContent(); // Revert changes
                  }}>Cancel</button>
                </>
              )}
            </div>
          )}

          <div className="about-content-display">
            {loading ? (
              <div className="about-loading">Loading about content...</div>
            ) : isEditing ? (
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
      </div>
    </div>
  );
};

export default AboutModal;

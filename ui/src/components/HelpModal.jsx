import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import globalSettingsService from '../services/globalSettings.service';
import './HelpModal.css';
import AuthService from '../services/auth.service';

const HelpModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [helpContent, setHelpContent] = useState('Loading help content...');
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHelpContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use public endpoint for reading (requires authentication, not admin)
      const content = await globalSettingsService.getHelpAboutContent();
      setHelpContent(content.help_content || '<h1>Welcome to the Help Page!</h1><p>This is a placeholder for help content. Administrators can edit this content.</p>');
    } catch (err) {
      console.error('Failed to fetch help content:', err);
      setError('Failed to load help content.');
      setHelpContent('<h1>Welcome to the Help Page!</h1><p>This is a placeholder for help content. Administrators can edit this content.</p>'); // Fallback content
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHelpContent();
      setIsEditing(false); // Reset editing state when modal opens
      // Hide sidebar when modal is open
      document.body.classList.add('help-modal-open');
    } else {
      document.body.classList.remove('help-modal-open');
    }
    return () => {
      document.body.classList.remove('help-modal-open');
    };
  }, [isOpen, fetchHelpContent]);

  const handleSave = async () => {
    setMessage('');
    try {
      const currentToken = AuthService.getToken();
      if (!currentToken) {
        setError('Authentication token missing. Please log in again.');
        return;
      }
      const currentGlobalSettings = await globalSettingsService.getGlobalSettings(currentToken);
      await globalSettingsService.updateGlobalSettings({ ...currentGlobalSettings, help_content: helpContent }, currentToken);
      setMessage('Help content saved successfully!');
      setIsEditing(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save help content:', err);
      setMessage('Failed to save help content.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className="help-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-header">
          <h2>Help</h2>
          <button className="help-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="help-modal-body">
          {message && <div className="help-message">{message}</div>}
          {error && <div className="help-error">{error}</div>}
          
          {currentUser && currentUser.is_admin && (
            <div className="help-admin-controls">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)}>Edit Help Content</button>
              ) : (
                <>
                  <button onClick={handleSave} className="save-button">Save</button>
                  <button onClick={() => {
                      setIsEditing(false);
                      fetchHelpContent(); // Revert changes
                  }}>Cancel</button>
                </>
              )}
            </div>
          )}

          <div className="help-content-display">
            {loading ? (
              <div className="help-loading">Loading help content...</div>
            ) : isEditing ? (
              <textarea
                value={helpContent}
                onChange={(e) => setHelpContent(e.target.value)}
                rows="20"
                style={{ width: '100%', padding: '10px', minHeight: '300px' }}
              />
            ) : (
              <div 
                id="top"
                dangerouslySetInnerHTML={{ __html: helpContent }}
                onClick={(e) => {
                  // Handle anchor link clicks within the help content
                  const target = e.target.closest('a[href^="#"]');
                  if (target) {
                    e.preventDefault();
                    const href = target.getAttribute('href');
                    const modalContent = document.querySelector('.help-modal-content');
                    if (!modalContent) return;
                    
                    if (href === '#top') {
                      // Scroll to top of modal content
                      modalContent.scrollTo({ top: 0, behavior: 'smooth' });
                    } else if (href.startsWith('#')) {
                      // Handle other anchor links (TOC links)
                      const targetId = href.substring(1);
                      // Wait a bit for the content to be rendered if needed
                      setTimeout(() => {
                        const targetElement = document.getElementById(targetId) || 
                                            document.querySelector(`[name="${targetId}"]`) ||
                                            document.querySelector(`a[name="${targetId}"]`);
                        if (targetElement) {
                          const headerHeight = document.querySelector('.help-modal-header')?.offsetHeight || 0;
                          const bodyPadding = 30; // padding of help-modal-body
                          const targetPosition = targetElement.getBoundingClientRect().top + 
                                                modalContent.scrollTop - 
                                                headerHeight - 
                                                bodyPadding - 
                                                20; // extra offset
                          modalContent.scrollTo({ top: Math.max(0, targetPosition), behavior: 'smooth' });
                        }
                      }, 100);
                    }
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;

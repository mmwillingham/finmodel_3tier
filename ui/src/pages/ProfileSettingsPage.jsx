import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import ApiService from '../services/api.service'; // Use the corrected ApiService
import { useAuth } from '../context/AuthContext';
import { useSettingsContext } from '../context/SettingsContext.jsx';
import './SettingsPages.css';

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const { settings, refreshSettings } = useSettingsContext();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isLegacyUser, setIsLegacyUser] = useState(false);
  
  const [formData, setFormData] = useState({
    p1FirstName: '',
    p1LastName: '',
    mfaEnabled: false,
    newEmail: ''
  });

  useEffect(() => {
    if (settings) {
      // Check if the username (email field) contains an '@'
      const currentEmail = settings.email || '';
      const legacyStatus = !currentEmail.includes('@');
      setIsLegacyUser(legacyStatus);

      setFormData(prev => ({
        ...prev,
        p1FirstName: settings.person1_first_name || '',
        p1LastName: settings.person1_last_name || '',
        newEmail: legacyStatus ? '' : currentEmail,
        mfaEnabled: !!settings.mfa_enabled
      }));
    }
  }, [settings]);

  const handleSave = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Validate email format if they are a legacy user trying to enable MFA
    if (isLegacyUser && formData.mfaEnabled && !emailRegex.test(formData.newEmail)) {
        setMessage("Error: A valid email is required to enable MFA.");
        return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      // 1. Update General Profile (First/Last Name)
      const profilePayload = {
        person1_first_name: formData.p1FirstName,
        person1_last_name: formData.p1LastName,
        // MFA only enables immediately for existing email users
        mfa_enabled: isLegacyUser ? false : formData.mfaEnabled 
      };

      await SettingsService.updateSettings(profilePayload);

      // 2. Handle Username-to-Email Migration separately
      if (isLegacyUser && formData.mfaEnabled) {
          // Hits the new dedicated migration endpoint
          await ApiService.post('/users/migrate-to-email', { email: formData.newEmail });
          setMessage("Profile updated! To finish enabling MFA, check your new email and click the verification link.");
      } else {
          // Standard success flow for non-identity changes
          setMessage("Settings saved successfully!");
          setTimeout(() => navigate('/app'), 2000);
      }

      await refreshSettings();
    } catch (e) {
      const errorDetail = e.response?.data?.detail || "Save failed.";
      setMessage(`Error: ${errorDetail}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="profile-settings-container">
      <h1 className="profile-main-title">Profile Settings</h1>
      {message && <div className={`message-banner ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}

      <div className="settings-section">
        <h2 className="section-header">Personal Information</h2>
        <div className="input-group">
          <label>First Name</label>
          <input type="text" value={formData.p1FirstName} onChange={e => setFormData({...formData, p1FirstName: e.target.value})} />
        </div>
        <div className="input-group">
          <label>Last Name</label>
          <input type="text" value={formData.p1LastName} onChange={e => setFormData({...formData, p1LastName: e.target.value})} />
        </div>
      </div>

      <div className="mfa-card">
        <div className="mfa-header">
          <div>
            <h3>Multi-Factor Authentication</h3>
            <p>Secure your account with a verification code.</p>
          </div>
          <label className="switch">
            <input type="checkbox" checked={formData.mfaEnabled} onChange={e => setFormData({...formData, mfaEnabled: e.target.checked})} />
            <span className="slider round"></span>
          </label>
        </div>

        {formData.mfaEnabled && isLegacyUser && (
          <div className="mfa-upgrade-notice">
            <p className="bg-amber-900/20 p-3 rounded border border-amber-600/50 text-sm mb-3">
              <strong>Action Required:</strong> To enable MFA, your username "{settings?.email}" must be changed to a verified email address.
            </p>
            <div className="input-group">
              <label>New Login Email</label>
              <input 
                type="email" 
                value={formData.newEmail} 
                placeholder="name@example.com" 
                onChange={e => setFormData({...formData, newEmail: e.target.value})} 
              />
            </div>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate('/app')}>Cancel</button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={loading}>
          {isLegacyUser && formData.mfaEnabled ? 'Verify & Migrate to Email' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
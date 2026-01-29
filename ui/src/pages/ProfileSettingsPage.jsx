import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import { useSettingsContext } from '../context/SettingsContext.jsx';
import './SettingsPages.css';

const ProfileSettingsPage = () => {
  const navigate = useNavigate();
  const { settings, refreshSettings } = useSettingsContext();

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
      const currentId = settings.email || '';
      const legacyStatus = !currentId.includes('@');
      setIsLegacyUser(legacyStatus);

      setFormData(prev => ({
        ...prev,
        p1FirstName: settings.person1_first_name || '',
        p1LastName: settings.person1_last_name || '',
        newEmail: legacyStatus ? '' : settings.email,
        mfaEnabled: !!settings.mfa_enabled
      }));
    }
  }, [settings]);

  const handleSave = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (isLegacyUser && formData.mfaEnabled && !emailRegex.test(formData.newEmail)) {
        setMessage("Error: A valid email is required to enable MFA.");
        return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      // Step 1: Save profile data ONLY. Do NOT include 'email' here.
      const profilePayload = { ...settings };
      delete profilePayload.email; // Ensure we don't trigger the ID update error
      profilePayload.person1_first_name = formData.p1FirstName;
      profilePayload.person1_last_name = formData.p1LastName;

      await SettingsService.updateSettings(profilePayload);

      // Step 2: Handle the Identity Migration separately
      if (isLegacyUser && formData.mfaEnabled) {
          await AuthService.requestEmailChange(formData.newEmail);
          setMessage("Profile saved! Check your email to verify your new login and finish enabling MFA.");
      } else {
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
            <p><strong>Username Update Required:</strong> Your login will change from "{settings?.email}" to your email.</p>
            <div className="input-group">
              <label>Login Email</label>
              <input type="email" value={formData.newEmail} placeholder="name@example.com" onChange={e => setFormData({...formData, newEmail: e.target.value})} />
            </div>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate('/app')}>Cancel</button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={loading}>
          {isLegacyUser && formData.mfaEnabled ? 'Verify & Enable MFA' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
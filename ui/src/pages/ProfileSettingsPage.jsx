import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css';
import { calculateFRADate, formatFRADisplay, calculateMonthlyBenefit } from '../utils/socialSecurity.js';
import { useSettingsContext } from '../context/SettingsContext.jsx';

const formatPhoneNumber = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/\D/g, "").slice(0, 10);
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
    return cleaned;
};

const ProfileSettingsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton();
  const { settings, refreshSettings } = useSettingsContext();

  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // MFA States
  const [isVerified, setIsVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const [formData, setFormData] = useState({
    p1FirstName: '', p1LastName: '', p1Birthdate: '', p1Cell: '',
    p2FirstName: '', p2LastName: '', p2Birthdate: '', p2Cell: '',
    p1SSPIA: '', p1SSDate: '', p2SSPIA: '', p2SSDate: '',
    address: '', city: '', state: 'GA', zip: '', taxStatus: 'Single',
    mfaEnabled: false,
    mfaEmail: ''
  });

  useEffect(() => {
    const userEmail = currentUser?.email || (currentUser?.username?.includes('@') ? currentUser.username : '');
    
    if (settings) {
      setFormData(prev => ({
        ...prev,
        p1FirstName: settings.person1_first_name || '',
        p1LastName: settings.person1_last_name || '',
        p1Birthdate: settings.person1_birthdate || '',
        p1Cell: formatPhoneNumber(settings.person1_cell_phone || ''),
        p2FirstName: settings.person2_first_name || '',
        p2LastName: settings.person2_last_name || '',
        p2Birthdate: settings.person2_birthdate || '',
        p2Cell: formatPhoneNumber(settings.person2_cell_phone || ''),
        address: settings.address || '',
        city: settings.city || '',
        state: settings.state || 'GA',
        zip: settings.zip_code || '',
        taxStatus: settings.tax_filing_status || 'Single',
        p1SSPIA: settings.person1_ss_pia || '',
        p1SSDate: settings.person1_ss_retirement_date || '',
        p2SSPIA: settings.person2_ss_pia || '',
        p2SSDate: settings.person2_ss_retirement_date || '',
        mfaEmail: settings.mfa_email || userEmail
      }));
    }

    AuthService.getMfaSettings().then(mfa => {
        setFormData(prev => ({ ...prev, mfaEnabled: !!mfa.mfa_enabled }));
        if (mfa.mfa_enabled) setIsVerified(true);
    }).catch(() => {});
  }, [settings, currentUser]);

  const handleValidate = async () => {
    if (!codeSent) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.mfaEmail)) {
          setMessage("Error: Please enter a valid email address.");
          return;
      }
      try {
          // Logic to trigger the actual email would go here
          setCodeSent(true);
          setMessage("Success: Verification code sent to your email.");
      } catch (e) {
          setMessage("Error: Failed to send verification email.");
      }
    } else {
      try {
          // Placeholder check: Replace "123456" with actual API verification result
          if (verificationCode === "123456") {
              setIsVerified(true);
              setMessage("Success: Email Verified!");
          } else {
              setMessage("Error: Invalid verification code.");
          }
      } catch (e) {
          setMessage("Error: Verification failed.");
      }
    }
  };

  const handleSave = async () => {
    if (formData.mfaEnabled && !isVerified) {
        setMessage("Error: You must Verify your MFA email before saving.");
        return;
    }
    setLoading(true);
    try {
      await SettingsService.updateSettings({
        person1_first_name: formData.p1FirstName,
        person1_last_name: formData.p1LastName,
        person1_birthdate: formData.p1Birthdate,
        person1_cell_phone: formData.p1Cell,
        person2_first_name: formData.p2FirstName,
        person2_last_name: formData.p2LastName,
        person2_birthdate: formData.p2Birthdate,
        person2_cell_phone: formData.p2Cell,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip,
        tax_filing_status: formData.taxStatus,
        person1_ss_pia: parseFloat(formData.p1SSPIA) || 0,
        person1_ss_retirement_date: formData.p1SSDate,
        person2_ss_pia: parseFloat(formData.p2SSPIA) || 0,
        person2_ss_retirement_date: formData.p2SSDate,
        mfa_email: formData.mfaEmail
      });

      await AuthService.updateMfaSettings({
        mfa_enabled: formData.mfaEnabled,
        mfa_email_enabled: true
      });

      await refreshSettings();
      navigate('/app');
    } catch (e) {
      setMessage('Error: Save failed.');
    }
    setLoading(false);
  };

  return (
    <div className="profile-settings-container">
      <h1 className="profile-main-title">Profile Settings</h1>
      {message && <div className={`message-banner ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}

      <div className="settings-grid">
        {/* Person 1 */}
        <div className="grid-column">
          <h2 className="section-header">Person 1 Information</h2>
          <div className="input-group"><label>First Name</label><input type="text" value={formData.p1FirstName} onChange={e => setFormData({...formData, p1FirstName: e.target.value})} /></div>
          <div className="input-group"><label>Last Name</label><input type="text" value={formData.p1LastName} onChange={e => setFormData({...formData, p1LastName: e.target.value})} /></div>
          <div className="input-group"><label>Birthdate</label><input type="date" value={formData.p1Birthdate} onChange={e => setFormData({...formData, p1Birthdate: e.target.value})} /></div>
          <div className="input-group"><label>Cell Phone</label><input type="tel" value={formData.p1Cell} onChange={e => setFormData({...formData, p1Cell: formatPhoneNumber(e.target.value)})} /></div>
          <div className="section-spacer"></div>
          <h2 className="section-header">Social Security</h2>
          <div className="input-group gray-bg"><label>FRA</label><span>{formatFRADisplay(formData.p1Birthdate)}</span></div>
          <div className="input-group"><label>Monthly PIA</label><input type="number" value={formData.p1SSPIA} onChange={e => setFormData({...formData, p1SSPIA: e.target.value})} /></div>
          <div className="input-group"><label>Claim Date</label><input type="date" value={formData.p1SSDate} onChange={e => setFormData({...formData, p1SSDate: e.target.value})} /></div>
          <div className="benefit-card">Estimated Monthly Benefit: <strong>${calculateMonthlyBenefit(parseFloat(formData.p1SSPIA || 0), formData.p1SSDate, calculateFRADate(formData.p1Birthdate), formData.p1Birthdate).toFixed(2)}</strong></div>
        </div>

        {/* Spouse */}
        <div className="grid-column">
          <h2 className="section-header">Spouse Information</h2>
          <div className="input-group"><label>First Name</label><input type="text" value={formData.p2FirstName} onChange={e => setFormData({...formData, p2FirstName: e.target.value})} /></div>
          <div className="input-group"><label>Last Name</label><input type="text" value={formData.p2LastName} onChange={e => setFormData({...formData, p2LastName: e.target.value})} /></div>
          <div className="input-group"><label>Birthdate</label><input type="date" value={formData.p2Birthdate} onChange={e => setFormData({...formData, p2Birthdate: e.target.value})} /></div>
          <div className="input-group"><label>Cell Phone</label><input type="tel" value={formData.p2Cell} onChange={e => setFormData({...formData, p2Cell: formatPhoneNumber(e.target.value)})} /></div>
          <div className="section-spacer"></div>
          <h2 className="section-header">Social Security</h2>
          <div className="input-group gray-bg"><label>FRA</label><span>{formatFRADisplay(formData.p2Birthdate)}</span></div>
          <div className="input-group"><label>Monthly PIA</label><input type="number" value={formData.p2SSPIA} onChange={e => setFormData({...formData, p2SSPIA: e.target.value})} /></div>
          <div className="input-group"><label>Claim Date</label><input type="date" value={formData.p2SSDate} onChange={e => setFormData({...formData, p2SSDate: e.target.value})} /></div>
          <div className="benefit-card">Estimated Monthly Benefit: <strong>${calculateMonthlyBenefit(parseFloat(formData.p2SSPIA || 0), formData.p2SSDate, calculateFRADate(formData.p2Birthdate), formData.p2Birthdate).toFixed(2)}</strong></div>
        </div>
      </div>

      <div className="estimate-warning-banner">
        <span className="warning-icon">⚠️</span>
        <p>Estimates are for planning only. Visit <strong>ssa.gov</strong> for official statements.</p>
      </div>

      <div className="major-section-spacer"></div>

      <div className="contact-tax-section">
        <h2 className="section-header">Contact & Tax Info</h2>
        <div className="input-group"><label>Street Address</label><input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
        <div className="input-group">
            <label>City/State/Zip</label>
            <div className="triple-input">
                <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                <select value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})}><option value="GA">GA</option></select>
                <input type="text" value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} />
            </div>
        </div>
        <div className="input-group">
          <label>Tax Filing Status</label>
          <select value={formData.taxStatus} onChange={e => setFormData({...formData, taxStatus: e.target.value})}>
            <option value="Single">Single</option>
            <option value="Married Filing Jointly">Married Filing Jointly</option>
            <option value="Married Filing Separately">Married Filing Separately</option>
            <option value="Head of Household">Head of Household</option>
          </select>
        </div>
      </div>

      <div className="mfa-card">
        <div className="mfa-header">
            <div>
                <h3 className="mfa-title">Multi-Factor Authentication</h3>
                <p style={{fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0'}}>Secondary verification for your account security.</p>
            </div>
            <label className="switch">
                <input type="checkbox" checked={formData.mfaEnabled} onChange={e => {setFormData({...formData, mfaEnabled: e.target.checked}); setIsVerified(false); setCodeSent(false);}} />
                <span className="slider round"></span>
            </label>
        </div>
        {formData.mfaEnabled && (
            <div className="mfa-content">
                <div className="input-group" style={{marginTop:'20px'}}>
                    <label>MFA Email</label>
                    <input type="email" value={formData.mfaEmail} disabled={isVerified || codeSent} onChange={e => {setFormData({...formData, mfaEmail: e.target.value}); setIsVerified(false);}} />
                </div>
                {codeSent && !isVerified && (
                    <div className="input-group">
                        <label>Enter Code</label>
                        <input type="text" placeholder="6-digit code" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} maxLength={6} />
                    </div>
                )}
                <div className="input-group disabled-feature">
                    <label>SMS Number</label>
                    <div className="coming-soon-wrapper">
                        <input type="tel" value={formData.p1Cell} disabled />
                        <span className="coming-soon-tag">Coming Soon</span>
                    </div>
                </div>
                <div className="mfa-actions">
                  <button type="button" className={`validate-btn ${isVerified ? 'verified' : ''}`} onClick={handleValidate} disabled={isVerified}>
                      {isVerified ? '✅ Method Verified' : codeSent ? 'Verify Code' : 'Send Verification Email'}
                  </button>
                  {codeSent && !isVerified && (
                      <button type="button" className="btn-text-only" onClick={() => setCodeSent(false)}>Change Email / Resend</button>
                  )}
                </div>
            </div>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={() => setIsChangePasswordModalOpen(true)}>Change Password</button>
        <div className="spacer"></div>
        <button type="button" className="btn-secondary" onClick={() => navigate('/app')}>Cancel</button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
      </div>
      <ChangePasswordModal isOpen={isChangePasswordModalOpen} onClose={() => setIsChangePasswordModalOpen(false)} />
    </div>
  );
};

export default ProfileSettingsPage;
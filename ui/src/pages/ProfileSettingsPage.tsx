import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import SettingsService from '../services/settings.service';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal'; // Assuming you have this component
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages
import { calculateFRADate, formatFRADisplay, calculateMonthlyBenefit, getMinRetirementDate } from '../utils/socialSecurity';
import { useSettingsContext } from '../context/SettingsContext';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { projectionActionButtonSx, projectionSecondaryButtonSx } from "../utils/projectionUiStyles";

const formatPhoneNumber = (value: any) => {
    if (!value) return "";
    value = value.replace(/\D/g, ""); // Remove non-digits
    if (value.length > 10) {
        value = value.slice(0, 10);
    }
    if (value.length > 6) {
        return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
    } else if (value.length > 3) {
        return `(${value.slice(0, 3)}) ${value.slice(3)}`;
    }
    return value;
};

const states = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY'
];

const ProfileSettingsPage = () => {
  const { currentUser, viewingUserId } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [person1FirstName, setPerson1FirstName] = useState("");
  const [person1LastName, setPerson1LastName] = useState("");
  const [person1Birthdate, setPerson1Birthdate] = useState("");
  const [person1CellPhone, setPerson1CellPhone] = useState("");
  const [person2FirstName, setPerson2FirstName] = useState("");
  const [person2LastName, setPerson2LastName] = useState("");
  const [person2Birthdate, setPerson2Birthdate] = useState("");
  const [person2CellPhone, setPerson2CellPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [taxFilingStatus, setTaxFilingStatus] = useState("Single");
  // Social Security fields for Person 1
  const [person1SSPIA, setPerson1SSPIA] = useState("");
  const [person1SSRetirementDate, setPerson1SSRetirementDate] = useState("");
  const [person1SSCOLA, setPerson1SSCOLA] = useState("");
  // Social Security fields for Person 2
  const [person2SSPIA, setPerson2SSPIA] = useState("");
  const [person2SSRetirementDate, setPerson2SSRetirementDate] = useState("");
  const [person2SSCOLA, setPerson2SSCOLA] = useState("");
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { settings, loading: settingsLoading, refreshSettings } = useSettingsContext();
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaEmailEnabled, setMfaEmailEnabled] = useState(true);
  const [mfaPasskeyEnabled, setMfaPasskeyEnabled] = useState(false);
  const [mfaPasskeyRegistered, setMfaPasskeyRegistered] = useState(false);
  const [mfaPasskeyCount, setMfaPasskeyCount] = useState(0);
  const [passkeyCredentials, setPasskeyCredentials] = useState<any[]>([]);
  const [passkeySavingId, setPasskeySavingId] = useState<string | null>(null);
  const [passkeyDeletingId, setPasskeyDeletingId] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(true);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyInfo, setPasskeyInfo] = useState('');
  const [passkeyError, setPasskeyError] = useState('');

  useEffect(() => {
    if (!settings) {
      return;
    }
    const typedSettings = settings as any;
    setPerson1FirstName(typedSettings.person1_first_name || "");
    setPerson1LastName(typedSettings.person1_last_name || "");
    setPerson1Birthdate(typedSettings.person1_birthdate || "");
    setPerson1CellPhone(typedSettings.person1_cell_phone || "");
    setPerson2FirstName(typedSettings.person2_first_name || "");
    setPerson2LastName(typedSettings.person2_last_name || "");
    setPerson2Birthdate(typedSettings.person2_birthdate || "");
    setPerson2CellPhone(typedSettings.person2_cell_phone || "");
    setAddress(typedSettings.address || "");
    setCity(typedSettings.city || "");
    setState(typedSettings.state || "");
    setZipCode(typedSettings.zip_code || "");
    setTaxFilingStatus(typedSettings.tax_filing_status || "Single");
    setPerson1SSPIA(typedSettings.person1_ss_pia?.toString() || "");
    setPerson1SSRetirementDate(typedSettings.person1_ss_retirement_date || "");
    setPerson1SSCOLA(typedSettings.person1_ss_cola?.toString() || "");
    setPerson2SSPIA(typedSettings.person2_ss_pia?.toString() || "");
    setPerson2SSRetirementDate(typedSettings.person2_ss_retirement_date || "");
    setPerson2SSCOLA(typedSettings.person2_ss_cola?.toString() || "");
  }, [settings]);

  useEffect(() => {
    const loadMfaSettings = async () => {
      try {
        setPasskeySupported(browserSupportsWebAuthn());
        const mfa = await AuthService.getMfaSettings();
        setMfaEnabled(Boolean(mfa.mfa_enabled));
        setMfaEmailEnabled(Boolean(mfa.mfa_email_enabled));
        setMfaPasskeyEnabled(Boolean(mfa.mfa_passkey_enabled));
        setMfaPasskeyRegistered(Boolean(mfa.mfa_passkey_registered));
        setMfaPasskeyCount(Number(mfa.mfa_passkey_count || 0));
        const credentials = await AuthService.listPasskeyCredentials();
        setPasskeyCredentials(Array.isArray(credentials) ? credentials : []);
      } catch (e: any) {
      }
    };
    if (!viewingUserId) {
      loadMfaSettings();
    }
  }, [viewingUserId]);

  const handleSave = async () => {
    setMessage('');
    setLoading(true);
    try {
      await SettingsService.updateSettings({
        person1_first_name: person1FirstName,
        person1_last_name: person1LastName,
        person1_birthdate: person1Birthdate || null,
        person1_cell_phone: person1CellPhone || null,
        person2_first_name: person2FirstName,
        person2_last_name: person2LastName,
        person2_birthdate: person2Birthdate || null,
        person2_cell_phone: person2CellPhone || null,
        address: address,
        city: city,
        state: state,
        zip_code: zipCode,
        tax_filing_status: taxFilingStatus,
        // Social Security fields
        person1_ss_pia: person1SSPIA ? parseFloat(person1SSPIA) : null,
        person1_ss_retirement_date: person1SSRetirementDate || null,
        person1_ss_cola: person1SSCOLA ? parseFloat(person1SSCOLA) : null,
        person2_ss_pia: person2SSPIA ? parseFloat(person2SSPIA) : null,
        person2_ss_retirement_date: person2SSRetirementDate || null,
        person2_ss_cola: person2SSCOLA ? parseFloat(person2SSCOLA) : null,
      });
      await AuthService.updateMfaSettings({
        mfa_enabled: mfaEnabled,
        mfa_email_enabled: mfaEmailEnabled,
        mfa_passkey_enabled: mfaPasskeyEnabled,
      });
      await refreshSettings();
      setMessage('Profile settings saved successfully!');
      setTimeout(() => {
        setMessage('');
        navigate('/app'); // Navigate to home after successful save
      }, 1000);
    } catch (e: any) {
      const errorMessage = e.response?.data?.detail || 'Error saving settings';
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (settingsLoading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={18} />
        <Typography variant="body2">Loading profile settings...</Typography>
      </Stack>
    );
  }

  // Show message if viewing another account's data
  if (viewingUserId) {
    return (
      <Box>
        <Typography variant="h5" fontWeight="600" sx={{ mb: 2 }}>Profile Settings</Typography>
        <Alert severity="warning" variant="outlined">
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Viewing Another Account</Typography>
          <Typography variant="body2">
            You are currently viewing data from another account. Profile settings can only be edited for your own account.
            Please switch to viewing your own account in <strong>Settings → Switch Account View</strong> to edit your profile.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <div className="settings-page-container">
      <h2>Profile Settings</h2>
      {message && (
        <Alert severity={message.toLowerCase().includes('error') ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <div className="profile-settings-form">
        <div className="people-grid">
          <div className="person-column">
            <h3 style={{ marginBottom: '12px' }}>Person 1</h3>
            <div className="form-group-horizontal">
              <label htmlFor="person1-first-name">First Name</label>
              <input
                id="person1-first-name"
                type="text"
                value={person1FirstName}
                onChange={(e: any) => setPerson1FirstName(e.target.value)}
                placeholder="First Name"
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="person1-last-name">Last Name</label>
              <input
                id="person1-last-name"
                type="text"
                value={person1LastName}
                onChange={(e: any) => setPerson1LastName(e.target.value)}
                placeholder="Last Name"
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="person1-birthdate">Date of Birth</label>
              <input
                id="person1-birthdate"
                type="date"
                value={person1Birthdate}
                onChange={(e: any) => setPerson1Birthdate(e.target.value)}
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="person1-cell-phone">Cell Phone</label>
              <input
                id="person1-cell-phone"
                type="tel"
                value={person1CellPhone}
                onChange={(e: any) => setPerson1CellPhone(formatPhoneNumber(e.target.value))}
                placeholder="(XXX) XXX-XXXX"
              />
            </div>

            <div style={{ width: '100%', marginTop: '18px', paddingTop: '10px', borderTop: '1px dashed var(--color-border)' }}>
              <h4 style={{ marginBottom: '10px' }}>Social Security</h4>
              <div style={{ padding: '10px 15px', backgroundColor: 'rgba(56, 189, 248, 0.16)', borderLeft: '4px solid #38bdf8', borderRadius: '4px', fontSize: '0.9rem', color: '#bae6fd', marginBottom: '12px' }}>
                <strong>Note:</strong> The calculated monthly benefit is an approximation. For the most accurate estimate, refer to ssa.gov.
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person1-ss-fra">Full Retirement Age (FRA)</label>
                <input
                  id="person1-ss-fra"
                  type="text"
                  value={formatFRADisplay(person1Birthdate)}
                  disabled
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.66)', color: '#cbd5e1', cursor: 'not-allowed' }}
                  placeholder="Calculated from date of birth"
                />
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person1-ss-pia">Full Retirement Monthly Benefit (PIA)</label>
                <input
                  id="person1-ss-pia"
                  type="number"
                  step="0.01"
                  value={person1SSPIA}
                  onChange={(e: any) => setPerson1SSPIA(e.target.value)}
                  placeholder="Available at ssa.gov"
                />
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person1-ss-retirement-date">Social Security Retirement Date</label>
                <input
                  id="person1-ss-retirement-date"
                  type="date"
                  value={person1SSRetirementDate}
                  onChange={(e: any) => setPerson1SSRetirementDate(e.target.value)}
                  min={getMinRetirementDate(person1Birthdate) || undefined}
                  placeholder="After 62nd birthday"
                />
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person1-ss-cola">Social Security COLA (avg) %</label>
                <input
                  id="person1-ss-cola"
                  type="number"
                  step="0.1"
                  value={person1SSCOLA}
                  onChange={(e: any) => setPerson1SSCOLA(e.target.value)}
                  placeholder="Average COLA percentage"
                />
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person1-ss-monthly-benefit">Monthly Benefit (calculated)</label>
                <input
                  id="person1-ss-monthly-benefit"
                  type="text"
                  value={person1SSPIA && person1SSRetirementDate ?
                    `$${calculateMonthlyBenefit(parseFloat(person1SSPIA), person1SSRetirementDate, calculateFRADate(person1Birthdate), person1Birthdate).toFixed(2)}` :
                    ''}
                  disabled
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.66)', color: '#cbd5e1', cursor: 'not-allowed' }}
                  placeholder="Calculated based on PIA and retirement date"
                />
              </div>
            </div>
          </div>

          <div className="person-column">
            <h3 style={{ marginBottom: '12px' }}>Spouse</h3>
            <div className="form-group-horizontal">
              <label htmlFor="person2-first-name">First Name</label>
              <input
                id="person2-first-name"
                type="text"
                value={person2FirstName}
                onChange={(e: any) => setPerson2FirstName(e.target.value)}
                placeholder="Spouse First Name"
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="person2-last-name">Last Name</label>
              <input
                id="person2-last-name"
                type="text"
                value={person2LastName}
                onChange={(e: any) => setPerson2LastName(e.target.value)}
                placeholder="Spouse Last Name"
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="person2-birthdate">Date of Birth</label>
              <input
                id="person2-birthdate"
                type="date"
                value={person2Birthdate}
                onChange={(e: any) => setPerson2Birthdate(e.target.value)}
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="person2-cell-phone">Cell Phone</label>
              <input
                id="person2-cell-phone"
                type="tel"
                value={person2CellPhone}
                onChange={(e: any) => setPerson2CellPhone(formatPhoneNumber(e.target.value))}
                placeholder="(XXX) XXX-XXXX"
              />
            </div>

            <div style={{ width: '100%', marginTop: '18px', paddingTop: '10px', borderTop: '1px dashed var(--color-border)' }}>
              <h4 style={{ marginBottom: '10px' }}>Social Security</h4>
              <div style={{ padding: '10px 15px', backgroundColor: 'rgba(56, 189, 248, 0.16)', borderLeft: '4px solid #38bdf8', borderRadius: '4px', fontSize: '0.9rem', color: '#bae6fd', marginBottom: '12px' }}>
                <strong>Note:</strong> Spousal benefits are the higher of their own benefit or 1/2 of spouse's. Assumes Person 1 is the higher earner and both are alive.
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person2-ss-fra">Full Retirement Age (FRA)</label>
                <input
                  id="person2-ss-fra"
                  type="text"
                  value={formatFRADisplay(person2Birthdate)}
                  disabled
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.66)', color: '#cbd5e1', cursor: 'not-allowed' }}
                  placeholder="Calculated from date of birth"
                />
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person2-ss-pia">Full Retirement Monthly Benefit (PIA)</label>
                <input
                  id="person2-ss-pia"
                  type="number"
                  step="0.01"
                  value={person2SSPIA}
                  onChange={(e: any) => setPerson2SSPIA(e.target.value)}
                  placeholder="Available at ssa.gov"
                />
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person2-ss-retirement-date">Social Security Retirement Date</label>
                <input
                  id="person2-ss-retirement-date"
                  type="date"
                  value={person2SSRetirementDate}
                  onChange={(e: any) => setPerson2SSRetirementDate(e.target.value)}
                  min={getMinRetirementDate(person2Birthdate) || undefined}
                  placeholder="After 62nd birthday"
                />
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person2-ss-cola">Social Security COLA (avg) %</label>
                <input
                  id="person2-ss-cola"
                  type="number"
                  step="0.1"
                  value={person2SSCOLA}
                  onChange={(e: any) => setPerson2SSCOLA(e.target.value)}
                  placeholder="Average COLA percentage"
                />
              </div>
              <div className="form-group-horizontal">
                <label htmlFor="person2-ss-monthly-benefit">Monthly Benefit (calculated)</label>
                <input
                  id="person2-ss-monthly-benefit"
                  type="text"
                  value={person2SSPIA && person2SSRetirementDate ?
                    `$${calculateMonthlyBenefit(parseFloat(person2SSPIA), person2SSRetirementDate, calculateFRADate(person2Birthdate), person2Birthdate).toFixed(2)}` :
                    ''}
                  disabled
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.66)', color: '#cbd5e1', cursor: 'not-allowed' }}
                  placeholder="Calculated based on PIA and retirement date (higher of own or spousal benefit)"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="post-grid" style={{ width: '100%', marginTop: '30px', marginBottom: '20px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
          <div>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>Address & Tax Information</h3>
            <div className="form-group-horizontal">
              <label htmlFor="address">Address</label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e: any) => setAddress(e.target.value)}
                placeholder="Address"
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="city">City</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e: any) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="state">State</label>
              <select
                id="state"
                value={state}
                onChange={(e: any) => setState(e.target.value)}
              >
                <option value="">Select State</option>
                {states.map((s: any) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="zip-code">Zip Code</label>
              <input
                id="zip-code"
                type="text"
                value={zipCode}
                onChange={(e: any) => setZipCode(e.target.value)}
                placeholder="Zip Code"
              />
            </div>
            <div className="form-group-horizontal">
              <label htmlFor="tax-filing-status">Tax Filing Status</label>
              <select
                id="tax-filing-status"
                value={taxFilingStatus}
                onChange={(e: any) => setTaxFilingStatus(e.target.value)}
              >
                <option value="Single">Single</option>
                <option value="Married Filing Jointly">Married Filing Jointly</option>
                <option value="Married Filing Separately">Married Filing Separately</option>
                <option value="Head of Household">Head of Household</option>
                <option value="Qualifying Surviving Spouse">Qualifying Surviving Spouse</option>
              </select>
            </div>
          </div>

          <div>
            <div className="settings-section mfa-section" style={{ marginTop: 0 }}>
              <h3>Multi-Factor Authentication</h3>
              <p>Secure your account with a verification code.</p>
              <small style={{ color: '#94a3b8' }}>
                Enable MFA and choose at least one method. Passkey requires registration.
              </small>
              <div className="form-group-horizontal checkbox-group">
                <label htmlFor="mfa-enabled">Enable MFA</label>
                <label className="switch" aria-hidden>
                  <input
                    id="mfa-enabled"
                    type="checkbox"
                    checked={mfaEnabled}
                    onChange={(e: any) => {
                      const checked = e.target.checked;
                      setMfaEnabled(checked);
                      if (checked && !mfaEmailEnabled && !mfaPasskeyEnabled) {
                        setMfaEmailEnabled(true);
                      }
                      if (!checked) {
                        setMfaEmailEnabled(false);
                        setMfaPasskeyEnabled(false);
                      }
                    }}
                  />
                  <span className="slider" />
                </label>
              </div>
              <div className="form-group-horizontal" style={{ opacity: mfaEnabled ? 1 : 0.6 }}>
                <label htmlFor="mfa-email">Email Verification</label>
                <input
                  id="mfa-email"
                  type="checkbox"
                  checked={mfaEmailEnabled}
                  onChange={(e: any) => {
                    const checked = e.target.checked;
                    setMfaEmailEnabled(checked);
                  }}
                  disabled={!mfaEnabled}
                />
              </div>
              <div className="form-group-horizontal">
                <label />
                <input
                  type="text"
                  readOnly
                  value={(currentUser && (((currentUser as any).username) || currentUser.email)) || ''}
                  style={{ width: '280px', textAlign: 'right', marginLeft: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', color: '#e2e8f0', backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
                />
              </div>
              {passkeySupported && (
                <>
                  <div className="form-group-horizontal" style={{ opacity: mfaEnabled ? 1 : 0.6 }}>
                    <label htmlFor="mfa-passkey">Passkey (WebAuthn)</label>
                    <input
                      id="mfa-passkey"
                      type="checkbox"
                      checked={mfaPasskeyEnabled}
                      onChange={(e: any) => {
                        const checked = e.target.checked;
                        setMfaPasskeyEnabled(checked);
                      }}
                      disabled={!mfaEnabled}
                    />
                  </div>
                  <div className="form-group-horizontal" style={{ opacity: mfaEnabled ? 1 : 0.6 }}>
                    <label />
                    <div>
                      <button
                        type="button"
                        onClick={async () => {
                          setPasskeyError('');
                          setPasskeyInfo('');
                          setPasskeyLoading(true);
                          try {
                            const options = await AuthService.getPasskeyRegistrationOptions();
                            const registrationOptions = options?.publicKey || options;
                            if (!registrationOptions?.challenge) {
                              throw new Error('Passkey options missing challenge.');
                            }
                            const credential = await startRegistration({ optionsJSON: registrationOptions });
                            const verifyResp = await AuthService.verifyPasskeyRegistration(credential as any);
                            const nextCount = Number(verifyResp?.mfa_passkey_count || (mfaPasskeyCount + 1));
                            setMfaPasskeyCount(nextCount);
                            setMfaPasskeyRegistered(nextCount > 0);
                            setMfaPasskeyEnabled(true);
                            setPasskeyInfo('Passkey registered successfully.');
                            try {
                              const credentials = await AuthService.listPasskeyCredentials();
                              setPasskeyCredentials(Array.isArray(credentials) ? credentials : []);
                            } catch (err: any) {
                            }
                          } catch (err: any) {
                            setPasskeyError(err.response?.data?.detail || err.message || 'Failed to register passkey.');
                          } finally {
                            setPasskeyLoading(false);
                          }
                        }}
                        disabled={!mfaEnabled || !mfaPasskeyEnabled || passkeyLoading}
                        className="btn-primary-modern"
                        style={{ padding: '8px 12px' }}
                      >
                        {passkeyLoading ? 'Working...' : (mfaPasskeyRegistered ? 'Register Another Device' : 'Register This Device')}
                      </button>
                      {mfaPasskeyCount > 0 && (
                        <div style={{ color: '#94a3b8', marginTop: '6px' }}>
                          Registered passkeys: {mfaPasskeyCount}
                        </div>
                      )}
                      {passkeyInfo && <div style={{ color: '#155724', marginTop: '6px' }}>{passkeyInfo}</div>}
                      {passkeyError && <div style={{ color: '#721c24', marginTop: '6px' }}>{passkeyError}</div>}
                    </div>
                  </div>
                  {passkeyCredentials.length > 0 && (
                    <div className="form-group-horizontal" style={{ alignItems: 'flex-start', marginTop: '6px' }}>
                      <label>Passkeys</label>
                      <div style={{ flex: 1 }}>
                        {passkeyCredentials.map((cred: any) => (
                          <div key={cred.id} style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={cred.label || ''}
                              placeholder="Label (e.g., iPhone Face ID)"
                              onChange={(e: any) => {
                                const value = e.target.value;
                                setPasskeyCredentials((prev: any) => prev.map((item: any) => (
                                  item.id === cred.id ? { ...item, label: value } : item
                                )));
                              }}
                              style={{ flex: 1 }}
                              disabled={passkeySavingId === cred.id || passkeyDeletingId === cred.id}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                setPasskeyError('');
                                setPasskeyInfo('');
                                setPasskeySavingId(cred.id);
                                try {
                                  const updated = await AuthService.updatePasskeyCredential(cred.id, { label: cred.label || null });
                                  setPasskeyCredentials((prev: any) => prev.map((item: any) => (
                                    item.id === cred.id ? { ...item, label: updated.label } : item
                                  )));
                                  setPasskeyInfo('Passkey label saved.');
                                } catch (err: any) {
                                  setPasskeyError(err.response?.data?.detail || err.message || 'Failed to update passkey.');
                                } finally {
                                  setPasskeySavingId(null);
                                }
                              }}
                              disabled={passkeySavingId === cred.id || passkeyDeletingId === cred.id}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#6c757d', color: 'white', cursor: 'pointer' }}
                            >
                              {passkeySavingId === cred.id ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm('Delete this passkey? You will no longer be able to use it to sign in.')) {
                                  return;
                                }
                                setPasskeyError('');
                                setPasskeyInfo('');
                                setPasskeyDeletingId(cred.id);
                                try {
                                  await AuthService.deletePasskeyCredential(cred.id);
                                  setPasskeyCredentials((prev: any) => prev.filter((item: any) => item.id !== cred.id));
                                  const nextCount = Math.max(0, mfaPasskeyCount - 1);
                                  setMfaPasskeyCount(nextCount);
                                  setMfaPasskeyRegistered(nextCount > 0);
                                  if (nextCount === 0) {
                                    setMfaPasskeyEnabled(false);
                                  }
                                  setPasskeyInfo('Passkey deleted.');
                                } catch (err: any) {
                                  setPasskeyError(err.response?.data?.detail || err.message || 'Failed to delete passkey.');
                                } finally {
                                  setPasskeyDeletingId(null);
                                }
                              }}
                              disabled={passkeyDeletingId === cred.id || passkeySavingId === cred.id}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#dc3545', color: 'white', cursor: 'pointer' }}
                            >
                              {passkeyDeletingId === cred.id ? 'Deleting...' : 'Delete'}
                            </button>
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>
                              {cred.last_used_at ? `Last used: ${new Date(cred.last_used_at).toLocaleString()}` : 'Last used: never'}
                              {' · '}
                              {cred.created_at ? `Added: ${new Date(cred.created_at).toLocaleDateString()}` : 'Added: unknown'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="form-group-horizontal" style={{ marginTop: '12px' }}>


      </div>

        <div className="settings-page-actions">
          <Button 
            type="button" 
            variant="contained"
            onClick={() => setIsChangePasswordModalOpen(true)}
            sx={{ ...projectionActionButtonSx, textTransform: 'none' }}
          >
            Change Password
          </Button>
  
          <Button onClick={handleSave} variant="contained" sx={{ ...projectionActionButtonSx, textTransform: 'none' }}>Save</Button>
          <Button onClick={() => navigate('/app')} variant="outlined" sx={projectionSecondaryButtonSx}>Cancel</Button>
        </div>

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
};

export default ProfileSettingsPage;

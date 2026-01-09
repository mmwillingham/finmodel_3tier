import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal'; // Assuming you have this component
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages

const formatPhoneNumber = (value) => {
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
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await SettingsService.getSettings();
      setPerson1FirstName(res.data.person1_first_name || "");
      setPerson1LastName(res.data.person1_last_name || "");
      setPerson1Birthdate(res.data.person1_birthdate || "");
      setPerson1CellPhone(res.data.person1_cell_phone || "");
      setPerson2FirstName(res.data.person2_first_name || "");
      setPerson2LastName(res.data.person2_last_name || "");
      setPerson2Birthdate(res.data.person2_birthdate || "");
      setPerson2CellPhone(res.data.person2_cell_phone || "");
      setAddress(res.data.address || "");
      setCity(res.data.city || "");
      setState(res.data.state || "");
      setZipCode(res.data.zip_code || "");
      setTaxFilingStatus(res.data.tax_filing_status || "Single");
    } catch (e) {
      console.error('Failed to load profile settings', e);
      setError('Failed to load profile settings.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
      });
      setMessage('Profile settings saved successfully!');
      setTimeout(() => {
        setMessage('');
        navigate('/'); // Navigate to home after successful save
      }, 1000);
    } catch (e) {
      console.error('Failed to save profile settings', e);
      const errorMessage = e.response?.data?.detail || 'Error saving settings';
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-message">Loading profile settings...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  // Show message if viewing another account's data
  if (viewingUserId) {
    return (
      <div className="settings-page-container">
        <h2>Profile Settings</h2>
        <div style={{ 
          padding: '20px', 
          background: '#fff3cd', 
          borderRadius: '6px',
          border: '1px solid #ffc107',
          marginBottom: '20px'
        }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>
            ⚠️ Viewing Another Account
          </strong>
          <p style={{ margin: 0, color: '#666' }}>
            You are currently viewing data from another account. Profile settings can only be edited for your own account.
            Please switch to viewing your own account in <strong>Settings → Switch Account View</strong> to edit your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page-container">
      <h2>Profile Settings</h2>
      {message && <div className="message">{message}</div>}

      <div className="profile-settings-form">
        <div className="form-group-horizontal">
          <label htmlFor="person1-first-name">
            First Name
          </label>
          <input
            id="person1-first-name"
            type="text"
            value={person1FirstName}
            onChange={(e) => setPerson1FirstName(e.target.value)}
            placeholder="First Name"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="person1-last-name">
            Last Name
          </label>
          <input
            id="person1-last-name"
            type="text"
            value={person1LastName}
            onChange={(e) => setPerson1LastName(e.target.value)}
            placeholder="Last Name"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="person1-birthdate">
            Date of Birth
          </label>
          <input
            id="person1-birthdate"
            type="date"
            value={person1Birthdate}
            onChange={(e) => setPerson1Birthdate(e.target.value)}
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="person1-cell-phone">
            Cell Phone
          </label>
          <input
            id="person1-cell-phone"
            type="tel"
            value={person1CellPhone}
            onChange={(e) => setPerson1CellPhone(formatPhoneNumber(e.target.value))}
            placeholder="(XXX) XXX-XXXX"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="person2-first-name">
            Spouse First Name
          </label>
          <input
            id="person2-first-name"
            type="text"
            value={person2FirstName}
            onChange={(e) => setPerson2FirstName(e.target.value)}
            placeholder="Spouse First Name"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="person2-last-name">
            Spouse Last Name
          </label>
          <input
            id="person2-last-name"
            type="text"
            value={person2LastName}
            onChange={(e) => setPerson2LastName(e.target.value)}
            placeholder="Spouse Last Name"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="person2-birthdate">
            Spouse Date of Birth
          </label>
          <input
            id="person2-birthdate"
            type="date"
            value={person2Birthdate}
            onChange={(e) => setPerson2Birthdate(e.target.value)}
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="person2-cell-phone">
            Spouse Cell Phone
          </label>
          <input
            id="person2-cell-phone"
            type="tel"
            value={person2CellPhone}
            onChange={(e) => setPerson2CellPhone(formatPhoneNumber(e.target.value))}
            placeholder="(XXX) XXX-XXXX"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="address">
            Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="city">
            City
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="state">
            State
          </label>
          <select
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">Select State</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="zip-code">
            Zip Code
          </label>
          <input
            id="zip-code"
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="Zip Code"
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="tax-filing-status">
            Tax Filing Status
          </label>
          <select
            id="tax-filing-status"
            value={taxFilingStatus}
            onChange={(e) => setTaxFilingStatus(e.target.value)}
          >
            <option value="Single">Single</option>
            <option value="Married Filing Jointly">Married Filing Jointly</option>
            <option value="Married Filing Separately">Married Filing Separately (not currently implemented)</option>
            <option value="Head of Household">Head of Household (not currently implemented)</option>
            <option value="Qualifying Surviving Spouse">Qualifying Surviving Spouse (not currently implemented)</option>
          </select>
        </div>
        <div className="form-group-horizontal">
            <button type="button" className="change-password-btn" onClick={() => setIsChangePasswordModalOpen(true)}>Change Password</button>
        </div>
      </div>
      <div className="settings-page-actions">
        <button onClick={handleSave} className="save-button" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
};

export default ProfileSettingsPage;

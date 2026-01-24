import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal'; // Assuming you have this component
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages
import { calculateFRADate, formatFRADisplay, calculateMonthlyBenefit, getMinRetirementDate } from '../utils/socialSecurity.js';
import { useSettingsContext } from '../context/SettingsContext.jsx';

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

  useEffect(() => {
    if (!settings) {
      return;
    }
    setPerson1FirstName(settings.person1_first_name || "");
    setPerson1LastName(settings.person1_last_name || "");
    setPerson1Birthdate(settings.person1_birthdate || "");
    setPerson1CellPhone(settings.person1_cell_phone || "");
    setPerson2FirstName(settings.person2_first_name || "");
    setPerson2LastName(settings.person2_last_name || "");
    setPerson2Birthdate(settings.person2_birthdate || "");
    setPerson2CellPhone(settings.person2_cell_phone || "");
    setAddress(settings.address || "");
    setCity(settings.city || "");
    setState(settings.state || "");
    setZipCode(settings.zip_code || "");
    setTaxFilingStatus(settings.tax_filing_status || "Single");
    setPerson1SSPIA(settings.person1_ss_pia?.toString() || "");
    setPerson1SSRetirementDate(settings.person1_ss_retirement_date || "");
    setPerson1SSCOLA(settings.person1_ss_cola?.toString() || "");
    setPerson2SSPIA(settings.person2_ss_pia?.toString() || "");
    setPerson2SSRetirementDate(settings.person2_ss_retirement_date || "");
    setPerson2SSCOLA(settings.person2_ss_cola?.toString() || "");
  }, [settings]);

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
      await refreshSettings();
      setMessage('Profile settings saved successfully!');
      setTimeout(() => {
        setMessage('');
        navigate('/'); // Navigate to home after successful save
      }, 1000);
    } catch (e) {
      const errorMessage = e.response?.data?.detail || 'Error saving settings';
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (settingsLoading) {
    return <div className="loading-message">Loading profile settings...</div>;
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

        {/* Address and Tax Filing Status Section */}
        <div style={{ width: '100%', marginTop: '30px', marginBottom: '20px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>Address & Tax Information</h3>
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
              <option value="Married Filing Separately">Married Filing Separately</option>
              <option value="Head of Household">Head of Household</option>
              <option value="Qualifying Surviving Spouse">Qualifying Surviving Spouse</option>
            </select>
          </div>
        </div>

        {/* Social Security Section for Person 1 */}
        <div style={{ width: '100%', marginTop: '30px', marginBottom: '20px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>Person 1 - Social Security</h3>
          <div style={{ 
            padding: '10px 15px', 
            backgroundColor: '#fff3cd', 
            borderLeft: '4px solid #ffc107',
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#856404',
            marginBottom: '15px'
          }}>
            <strong>Note:</strong> The calculated monthly benefit is an approximation. For the most accurate estimate, refer to your official Social Security statement at ssa.gov.
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person1-ss-fra">
              Full Retirement Age (FRA)
            </label>
            <input
              id="person1-ss-fra"
              type="text"
              value={formatFRADisplay(person1Birthdate)}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              placeholder="Calculated from date of birth"
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person1-ss-pia">
              Full Retirement Monthly Benefit (PIA)
            </label>
            <input
              id="person1-ss-pia"
              type="number"
              step="0.01"
              value={person1SSPIA}
              onChange={(e) => setPerson1SSPIA(e.target.value)}
              placeholder="Available at ssa.gov"
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person1-ss-retirement-date">
              Social Security Retirement Date
            </label>
            <input
              id="person1-ss-retirement-date"
              type="date"
              value={person1SSRetirementDate}
              onChange={(e) => setPerson1SSRetirementDate(e.target.value)}
              min={getMinRetirementDate(person1Birthdate) || undefined}
              placeholder="After 62nd birthday"
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person1-ss-cola">
              Social Security COLA (avg) %
            </label>
            <input
              id="person1-ss-cola"
              type="number"
              step="0.1"
              value={person1SSCOLA}
              onChange={(e) => setPerson1SSCOLA(e.target.value)}
              placeholder="Average COLA percentage"
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person1-ss-monthly-benefit">
              Monthly Benefit (calculated)
            </label>
            <input
              id="person1-ss-monthly-benefit"
              type="text"
              value={person1SSPIA && person1SSRetirementDate ? 
                `$${calculateMonthlyBenefit(parseFloat(person1SSPIA), person1SSRetirementDate, calculateFRADate(person1Birthdate), person1Birthdate).toFixed(2)}` : 
                ''}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              placeholder="Calculated based on PIA and retirement date"
            />
          </div>
        </div>

        {/* Social Security Section for Person 2 */}
        <div style={{ width: '100%', marginTop: '30px', marginBottom: '20px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>Person 2 (Spouse) - Social Security</h3>
          <div style={{ 
            padding: '10px 15px', 
            backgroundColor: '#fff3cd', 
            borderLeft: '4px solid #ffc107',
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#856404',
            marginBottom: '15px'
          }}>
            <strong>Note:</strong> The calculated monthly benefit is an approximation. For the most accurate estimate, refer to your official Social Security statement at ssa.gov.
          </div>
          <div style={{ 
            padding: '10px 15px', 
            backgroundColor: '#e7f3ff', 
            borderLeft: '4px solid #0066cc',
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#004085',
            marginBottom: '15px'
          }}>
            <strong>Note:</strong> Spousal benefit calculations assume Person 1 is the higher earner and both spouses are alive. 
            Person 2's benefit is the higher of their own benefit or the spousal benefit (32.5-50% of Person 1's PIA, based on when Person 2 claims relative to Person 2's FRA).
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person2-ss-fra">
              Full Retirement Age (FRA)
            </label>
            <input
              id="person2-ss-fra"
              type="text"
              value={formatFRADisplay(person2Birthdate)}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              placeholder="Calculated from date of birth"
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person2-ss-pia">
              Full Retirement Monthly Benefit (PIA)
            </label>
            <input
              id="person2-ss-pia"
              type="number"
              step="0.01"
              value={person2SSPIA}
              onChange={(e) => setPerson2SSPIA(e.target.value)}
              placeholder="Available at ssa.gov"
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person2-ss-retirement-date">
              Social Security Retirement Date
            </label>
            <input
              id="person2-ss-retirement-date"
              type="date"
              value={person2SSRetirementDate}
              onChange={(e) => setPerson2SSRetirementDate(e.target.value)}
              min={getMinRetirementDate(person2Birthdate) || undefined}
              placeholder="After 62nd birthday"
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person2-ss-cola">
              Social Security COLA (avg) %
            </label>
            <input
              id="person2-ss-cola"
              type="number"
              step="0.1"
              value={person2SSCOLA}
              onChange={(e) => setPerson2SSCOLA(e.target.value)}
              placeholder="Average COLA percentage"
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="person2-ss-monthly-benefit">
              Monthly Benefit (calculated)
            </label>
            <input
              id="person2-ss-monthly-benefit"
              type="text"
              value={person2SSPIA && person2SSRetirementDate ? 
                `$${calculateMonthlyBenefit(parseFloat(person2SSPIA), person2SSRetirementDate, calculateFRADate(person2Birthdate), person2Birthdate).toFixed(2)}` : 
                ''}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              placeholder="Calculated based on PIA and retirement date (higher of own or spousal benefit)"
            />
          </div>
        </div>

        <div className="form-group-horizontal">
            <button 
              type="button" 
              className="change-password-btn" 
              onClick={() => setIsChangePasswordModalOpen(true)}
              style={{ 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                padding: '8px 16px', 
                borderRadius: '4px', 
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#0056b3'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#007bff'}
            >
              Change Password
            </button>
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

import React, { useState, useEffect } from 'react';
import SettingsService from '../../services/settings.service';
import './Wizard.css';
import { useSettingsContext } from '../../context/SettingsContext.jsx';

const formatPhoneNumber = (value) => {
    if (!value) return "";
    value = value.replace(/\D/g, "");
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

const ProfileSetupWizard = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form state
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

  useEffect(() => {
    if (isOpen) {
      loadExistingSettings();
    }
  }, [isOpen]);

  const loadExistingSettings = async () => {
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
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const { refreshSettings } = useSettingsContext();

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
      await refreshSettings();
      setMessage('Profile saved successfully!');
      setTimeout(() => {
        if (onComplete) onComplete();
        onClose();
      }, 1000);
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Error saving profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalSteps = 4;
  const stepTitles = [
    "Personal Information",
    "Spouse Information (Optional)",
    "Address & Tax Status",
    "Review & Save"
  ];

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>Walk Me Through: Setup Profile</h2>
          <button className="wizard-close" onClick={onClose}>×</button>
        </div>

        <div className="wizard-progress">
          <div className="wizard-steps">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i + 1} className={`wizard-step ${currentStep >= i + 1 ? 'active' : ''}`}>
                <div className="wizard-step-number">{i + 1}</div>
                <div className="wizard-step-title">{stepTitles[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="wizard-content">
          {message && <div className={`wizard-message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}

          {currentStep === 1 && (
            <div className="wizard-step-content">
              <h3>Step 1: Personal Information</h3>
              <div className="wizard-form">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={person1FirstName}
                    onChange={(e) => setPerson1FirstName(e.target.value)}
                    placeholder="Enter your first name"
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={person1LastName}
                    onChange={(e) => setPerson1LastName(e.target.value)}
                    placeholder="Enter your last name"
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={person1Birthdate}
                    onChange={(e) => setPerson1Birthdate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Cell Phone</label>
                  <input
                    type="tel"
                    value={person1CellPhone}
                    onChange={(e) => setPerson1CellPhone(formatPhoneNumber(e.target.value))}
                    placeholder="(XXX) XXX-XXXX"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="wizard-step-content">
              <h3>Step 2: Spouse Information (Optional)</h3>
              <p className="wizard-hint">You can skip this step if you're filing as Single or don't have a spouse.</p>
              <div className="wizard-form">
                <div className="form-group">
                  <label>Spouse First Name</label>
                  <input
                    type="text"
                    value={person2FirstName}
                    onChange={(e) => setPerson2FirstName(e.target.value)}
                    placeholder="Enter spouse's first name"
                  />
                </div>
                <div className="form-group">
                  <label>Spouse Last Name</label>
                  <input
                    type="text"
                    value={person2LastName}
                    onChange={(e) => setPerson2LastName(e.target.value)}
                    placeholder="Enter spouse's last name"
                  />
                </div>
                <div className="form-group">
                  <label>Spouse Date of Birth</label>
                  <input
                    type="date"
                    value={person2Birthdate}
                    onChange={(e) => setPerson2Birthdate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Spouse Cell Phone</label>
                  <input
                    type="tel"
                    value={person2CellPhone}
                    onChange={(e) => setPerson2CellPhone(formatPhoneNumber(e.target.value))}
                    placeholder="(XXX) XXX-XXXX"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="wizard-step-content">
              <h3>Step 3: Address & Tax Filing Status</h3>
              <div className="wizard-form">
                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address"
                  />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <select value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="">Select State</option>
                    {states.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Zip Code</label>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="Zip Code"
                  />
                </div>
                <div className="form-group">
                  <label>Tax Filing Status *</label>
                  <select value={taxFilingStatus} onChange={(e) => setTaxFilingStatus(e.target.value)}>
                    <option value="Single">Single</option>
                    <option value="Married Filing Jointly">Married Filing Jointly</option>
                    <option value="Married Filing Separately">Married Filing Separately</option>
                    <option value="Head of Household">Head of Household</option>
                    <option value="Qualifying Surviving Spouse">Qualifying Surviving Spouse</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="wizard-step-content">
              <h3>Step 4: Review & Save</h3>
              <div className="wizard-review">
                <div className="review-section">
                  <h4>Personal Information</h4>
                  <p><strong>Name:</strong> {person1FirstName} {person1LastName}</p>
                  {person1Birthdate && <p><strong>Date of Birth:</strong> {person1Birthdate}</p>}
                  {person1CellPhone && <p><strong>Cell Phone:</strong> {person1CellPhone}</p>}
                </div>
                {(person2FirstName || person2LastName) && (
                  <div className="review-section">
                    <h4>Spouse Information</h4>
                    <p><strong>Name:</strong> {person2FirstName} {person2LastName}</p>
                    {person2Birthdate && <p><strong>Date of Birth:</strong> {person2Birthdate}</p>}
                    {person2CellPhone && <p><strong>Cell Phone:</strong> {person2CellPhone}</p>}
                  </div>
                )}
                {(address || city || state || zipCode) && (
                  <div className="review-section">
                    <h4>Address</h4>
                    <p>{address}</p>
                    <p>{city}{city && state ? ', ' : ''}{state} {zipCode}</p>
                  </div>
                )}
                <div className="review-section">
                  <h4>Tax Filing Status</h4>
                  <p>{taxFilingStatus}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="wizard-actions">
          <button className="wizard-btn wizard-btn-secondary" onClick={handleBack} disabled={currentStep === 1}>
            Back
          </button>
          <button 
            className="wizard-btn wizard-btn-primary" 
            onClick={handleNext}
            disabled={loading || (currentStep === 1 && (!person1FirstName || !person1LastName))}
          >
            {currentStep === totalSteps ? (loading ? 'Saving...' : 'Save') : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetupWizard;


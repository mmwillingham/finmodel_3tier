import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import { useSettingsContext } from '../context/SettingsContext.jsx';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css';

const TaxHandlingPage = () => {
  const navigate = useNavigate();
  useSettingsBackButton();
  const { settings, loading: settingsLoading, refreshSettings } = useSettingsContext();
  const [taxYear, setTaxYear] = useState(2025);
  const [calculateFederalTax, setCalculateFederalTax] = useState(false);
  const [calculateStateTax, setCalculateStateTax] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!settings) return;
    setTaxYear(settings.tax_year || 2025);
    setCalculateFederalTax(settings.calculate_federal_tax ?? false);
    setCalculateStateTax(settings.calculate_state_tax ?? false);
  }, [settings]);

  const handleSave = async () => {
    setMessage('');
    try {
      await SettingsService.updateSettings({
        tax_year: parseInt(taxYear),
        calculate_federal_tax: calculateFederalTax,
        calculate_state_tax: calculateStateTax,
      });
      await refreshSettings();
      setMessage('Tax settings saved.');
      setTimeout(() => {
        setMessage('');
        navigate('/app');
      }, 800);
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Error saving tax settings');
    }
  };

  if (settingsLoading) {
    return <div className="loading-message">Loading tax settings...</div>;
  }

  return (
    <div className="settings-page-container">
      <h2>Tax Handling</h2>
      {message && <div className="message">{message}</div>}
      <div className="application-settings-form">
        <div className="form-group-horizontal">
          <label htmlFor="tax-year">Tax Year</label>
          <input
            id="tax-year"
            type="number"
            min="2020"
            max="2100"
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
            placeholder="2025"
          />
        </div>

        <div className="form-group-horizontal checkbox-group">
          <label htmlFor="calculate-federal-tax">Calculate Federal Income Tax</label>
          <input
            id="calculate-federal-tax"
            type="checkbox"
            checked={calculateFederalTax}
            onChange={(e) => setCalculateFederalTax(e.target.checked)}
          />
        </div>
        {calculateFederalTax && (
          <div style={{ padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '10px' }}>
            <small>
              <strong>Note:</strong> This will create a "Federal Income Tax (Calculated)" expense item. Tax filing status and Person 1 birthdate must be set in Profile Settings.
            </small>
          </div>
        )}

        <div className="form-group-horizontal checkbox-group">
          <label htmlFor="calculate-state-tax">Calculate State Income Tax</label>
          <input
            id="calculate-state-tax"
            type="checkbox"
            checked={calculateStateTax}
            onChange={(e) => setCalculateStateTax(e.target.checked)}
          />
        </div>
        {calculateStateTax && (
          <div style={{ padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '10px' }}>
            <small>
              <strong>Note:</strong> This will create a "State Income Tax (Calculated)" expense item. You must set your state in your Profile Settings to accurately calculate state taxes.
            </small>
          </div>
        )}

        <div className="settings-page-actions">
          <button onClick={handleSave} className="save-button">Save</button>
          <button onClick={() => navigate('/app')} className="cancel-button">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default TaxHandlingPage;


import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import { useAuth } from '../context/AuthContext';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages

const ApplicationSettingsPage = () => {
  const { currentUser, viewingUserId } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [inflationPercent, setInflationPercent] = useState(2.0);
  const [projectionYears, setProjectionYears] = useState(30);
  const [showChartTotals, setShowChartTotals] = useState(true);
  const [taxYear, setTaxYear] = useState(2025);
  const [calculateFederalTax, setCalculateFederalTax] = useState(false);
  const [calculateStateTax, setCalculateStateTax] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsRes = await SettingsService.getSettings();
      setInflationPercent(settingsRes.data.default_inflation_percent);
      setProjectionYears(settingsRes.data.projection_years || 30);
      setShowChartTotals(settingsRes.data.show_chart_totals ?? true);
      setTaxYear(settingsRes.data.tax_year || 2025);
      setCalculateFederalTax(settingsRes.data.calculate_federal_tax ?? false);
      setCalculateStateTax(settingsRes.data.calculate_state_tax ?? false);
    } catch (e) {
      console.error('Failed to load application settings', e);
      setError('Failed to load application settings.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, viewingUserId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setMessage('');
    try {
      await SettingsService.updateSettings({
        default_inflation_percent: parseFloat(inflationPercent),
        projection_years: parseInt(projectionYears),
        show_chart_totals: showChartTotals,
        tax_year: parseInt(taxYear),
        calculate_federal_tax: calculateFederalTax,
        calculate_state_tax: calculateStateTax,
      });
      // Navigate to home page after successful save
      navigate('/');
    } catch (e) {
      console.error('Failed to save application settings', e);
      const errorMessage = e.response?.data?.detail || 'Error saving settings';
      setMessage(errorMessage);
    }
  };


  if (loading) {
    return <div className="loading-message">Loading application settings...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <div className="settings-page-container">
      <h2>Application Settings</h2>
      {message && <div className="message">{message}</div>}

      <div className="application-settings-form">
        <div className="form-group-horizontal">
          <label htmlFor="default-inflation">
            Default Inflation Rate (%)
          </label>
          <input
            id="default-inflation"
            type="number"
            step="0.1"
            value={inflationPercent}
            onChange={(e) => setInflationPercent(e.target.value)}
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="projection-years">
            Number of Years to Project
          </label>
          <input
            id="projection-years"
            type="number"
            value={projectionYears}
            onChange={(e) => setProjectionYears(e.target.value)}
            placeholder="30"
          />
        </div>
        <div className="form-group-horizontal checkbox-group">
          <label htmlFor="show-chart-totals">
            Show Chart Totals
          </label>
          <input
            id="show-chart-totals"
            type="checkbox"
            checked={showChartTotals}
            onChange={(e) => setShowChartTotals(e.target.checked)}
          />
        </div>
        <div className="form-group-horizontal">
          <label htmlFor="tax-year">
            Tax Year
          </label>
          <input
            id="tax-year"
            type="number"
            min="2020"
            max="2100"
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
            placeholder="2025"
          />
          <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
            Tax brackets and deductions are currently only available for 2025. 
            Setting this allows updating brackets when new tax years become available.
          </small>
        </div>
        <div className="form-group-horizontal checkbox-group">
          <label htmlFor="calculate-federal-tax">
            Calculate Federal Income Tax
          </label>
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
              <strong>Note:</strong> This will create a "Federal Income Tax (Calculated)" expense item. 
              Tax filing status and Person 1 birthdate must be set in Profile Settings.
              <br /><br />
              <strong>Warning:</strong> Income tax calculations are estimates only and do not address the many variables 
              that can affect taxes (deductions, credits, exemptions, etc.). These calculations are for planning purposes 
              only. Please consult a tax professional for detailed tax advice.
            </small>
          </div>
        )}
        <div className="form-group-horizontal checkbox-group">
          <label htmlFor="calculate-state-tax">
            Calculate State Income Tax
          </label>
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
              <strong>Note:</strong> This will create a "State Income Tax (Calculated)" expense item. 
              <strong> You must set your state in your Profile Settings</strong> to accurately calculate state taxes. 
              Tax filing status and Person 1 birthdate must also be set in Profile Settings.
              <br /><br />
              <strong>Important:</strong> This application does not address multi-state or partial residency. 
              It assumes you will live in your state the entire year.
              <br /><br />
              <strong>Warning:</strong> Income tax calculations are estimates only and do not address the many variables 
              that can affect taxes (deductions, credits, exemptions, etc.). These calculations are for planning purposes 
              only. Please consult a tax professional for detailed tax advice.
            </small>
          </div>
        )}
        <div className="settings-page-actions">
          <button onClick={handleSave} className="save-button">Save</button>
          <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationSettingsPage;

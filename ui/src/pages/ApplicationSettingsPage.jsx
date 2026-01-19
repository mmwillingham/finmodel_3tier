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
  const [calculateFederalTax, setCalculateFederalTax] = useState(false);
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
      setCalculateFederalTax(settingsRes.data.calculate_federal_tax ?? false);
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
        calculate_federal_tax: calculateFederalTax,
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

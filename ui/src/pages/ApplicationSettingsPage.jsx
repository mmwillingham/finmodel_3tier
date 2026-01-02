import React, { useState, useEffect, useCallback } from 'react';
import SettingsService from '../services/settings.service';
import { useAuth } from '../context/AuthContext';
import './SettingsPages.css'; // General CSS for settings pages

const ApplicationSettingsPage = () => {
  const { currentUser } = useAuth();
  const [inflationPercent, setInflationPercent] = useState(2.0);
  const [projectionYears, setProjectionYears] = useState(30);
  const [showChartTotals, setShowChartTotals] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await SettingsService.getSettings();
      setInflationPercent(res.data.default_inflation_percent);
      setProjectionYears(res.data.projection_years || 30);
      setShowChartTotals(res.data.show_chart_totals ?? true);
    } catch (e) {
      console.error('Failed to load application settings', e);
      setError('Failed to load application settings.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

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
      });
      setMessage('Application settings saved successfully!');
      // No need to call onSettingsSaved or onClose as this is a page now
      setTimeout(() => {
        setMessage('');
      }, 1500);
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
        <button onClick={handleSave} className="save-button">Save</button>
      </div>
    </div>
  );
};

export default ApplicationSettingsPage;

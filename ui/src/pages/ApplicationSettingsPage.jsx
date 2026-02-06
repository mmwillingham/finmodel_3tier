import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import { useSettingsContext } from '../context/SettingsContext.jsx';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages

const ApplicationSettingsPage = () => {
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [inflationPercent, setInflationPercent] = useState(2.0);
  const [projectionYears, setProjectionYears] = useState(20);
  const [showChartTotals, setShowChartTotals] = useState(true);
  const { settings, loading: settingsLoading, refreshSettings } = useSettingsContext();
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setInflationPercent(settings.default_inflation_percent || 2.0);
    setProjectionYears(settings.projection_years || 20);
    setShowChartTotals(settings.show_chart_totals ?? true);
  }, [settings]);

  const handleSave = async () => {
    setMessage('');
    setError(null);
    try {
      await SettingsService.updateSettings({
        default_inflation_percent: parseFloat(inflationPercent),
        projection_years: parseInt(projectionYears),
        show_chart_totals: showChartTotals,
      });
      await refreshSettings();
      navigate('/app');
    } catch (e) {
      const errorMessage = e.response?.data?.detail || 'Error saving settings';
      setMessage(errorMessage);
    }
  };


  if (settingsLoading) {
    return <div className="loading-message">Loading application settings...</div>;
  }

  return (
    <div className="settings-page-container">
      <h2>Application Settings</h2>
      {message && <div className="message">{message}</div>}

      <div className="application-settings-form">
        <div className="form-group-horizontal">
          <label htmlFor="default-inflation">
            Inflation Rate Percentage (Default)
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
            Projection Years (Default)
          </label>
          <input
            id="projection-years"
            type="number"
            value={projectionYears}
            onChange={(e) => setProjectionYears(e.target.value)}
            placeholder="20"
          />
        </div>
        <div className="form-group-horizontal checkbox-group">
          <label htmlFor="show-chart-totals">
            Show Chart Totals (Default)
          </label>
          <input
            id="show-chart-totals"
            type="checkbox"
            checked={showChartTotals}
            onChange={(e) => setShowChartTotals(e.target.checked)}
          />
        </div>
        {/* Tax handling moved to Tax Handling page */}
        <div className="settings-page-actions">
          <button onClick={handleSave} className="save-button">Save</button>
          <button onClick={() => navigate('/app')} className="cancel-button">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationSettingsPage;

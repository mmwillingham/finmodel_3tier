import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import AssetService from '../services/asset.service';
import CashFlowService from '../services/cashflow.service';
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
  const [cashAssetIds, setCashAssetIds] = useState([]);
  const [cashInSourceIds, setCashInSourceIds] = useState([]);
  const [cashOutSourceIds, setCashOutSourceIds] = useState([]);
  const [assets, setAssets] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, assetsRes, incomeRes, expenseRes] = await Promise.all([
        SettingsService.getSettings(),
        AssetService.list(viewingUserId || null).catch(() => ({ data: [] })),
        CashFlowService.list(true, viewingUserId).catch(() => ({ data: [] })),
        CashFlowService.list(false, viewingUserId).catch(() => ({ data: [] }))
      ]);
      setInflationPercent(settingsRes.data.default_inflation_percent);
      setProjectionYears(settingsRes.data.projection_years || 30);
      setShowChartTotals(settingsRes.data.show_chart_totals ?? true);
      setCashAssetIds(settingsRes.data.cash_asset_ids || []);
      setCashInSourceIds(settingsRes.data.cash_in_source_ids || []);
      setCashOutSourceIds(settingsRes.data.cash_out_source_ids || []);
      setAssets(assetsRes.data || []);
      setIncomeItems(incomeRes.data || []);
      setExpenseItems(expenseRes.data || []);
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
        cash_asset_ids: cashAssetIds,
        cash_in_source_ids: cashInSourceIds,
        cash_out_source_ids: cashOutSourceIds,
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

  const handleCashAssetToggle = (assetId) => {
    setCashAssetIds(prev => {
      if (prev.includes(assetId)) {
        return prev.filter(id => id !== assetId);
      } else {
        return [...prev, assetId];
      }
    });
  };

  const handleCashInSourceToggle = (itemId) => {
    setCashInSourceIds(prev => {
      // If empty (all included), populate with all except the one being unchecked
      if (prev.length === 0) {
        const allIds = incomeItems.map(item => item.id);
        return allIds.filter(id => id !== itemId);
      }
      // If unchecking an item, remove it from the array
      if (prev.includes(itemId)) {
        const newArray = prev.filter(id => id !== itemId);
        // If all items become selected (array empty), return empty array (means all included)
        if (newArray.length === 0 || newArray.length === incomeItems.length) {
          return [];
        }
        return newArray;
      }
      // If checking an item, add it to the array
      const newArray = [...prev, itemId];
      // If all items become selected, return empty array (means all included)
      if (newArray.length === incomeItems.length) {
        return [];
      }
      return newArray;
    });
  };

  const handleCashOutSourceToggle = (itemId) => {
    setCashOutSourceIds(prev => {
      // If empty (all included), populate with all except the one being unchecked
      if (prev.length === 0) {
        const allIds = expenseItems.map(item => item.id);
        return allIds.filter(id => id !== itemId);
      }
      // If unchecking an item, remove it from the array
      if (prev.includes(itemId)) {
        const newArray = prev.filter(id => id !== itemId);
        // If all items become selected (array empty), return empty array (means all included)
        if (newArray.length === 0 || newArray.length === expenseItems.length) {
          return [];
        }
        return newArray;
      }
      // If checking an item, add it to the array
      const newArray = [...prev, itemId];
      // If all items become selected, return empty array (means all included)
      if (newArray.length === expenseItems.length) {
        return [];
      }
      return newArray;
    });
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
        <div className="form-group-horizontal" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <label htmlFor="cash-assets" style={{ marginBottom: '10px', fontWeight: 600 }}>
            Cash Assets (for BASE Model and Sankey Diagram)
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gap: '8px', 
            width: '100%',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #ddd',
            padding: '10px',
            borderRadius: '4px'
          }}>
            {assets.map((asset) => (
              <label key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={cashAssetIds.includes(asset.id)}
                  onChange={() => handleCashAssetToggle(asset.id)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{asset.name} ({asset.category})</span>
              </label>
            ))}
          </div>
          <small style={{ marginTop: '5px', color: '#666' }}>
            Select assets that should be considered as cash for the BASE Model and Sankey Diagram visualizations.
          </small>
        </div>
        <div className="form-group-horizontal" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <label htmlFor="cash-in-sources" style={{ marginBottom: '10px', fontWeight: 600 }}>
            Cash-In Sources (for BASE Model and Sankey Diagram)
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gap: '8px', 
            width: '100%',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #ddd',
            padding: '10px',
            borderRadius: '4px'
          }}>
            {incomeItems.length === 0 ? (
              <span style={{ color: '#666', fontStyle: 'italic' }}>No income items found. Add income items first.</span>
            ) : (
              incomeItems.map((item) => {
                const isChecked = cashInSourceIds.length === 0 || cashInSourceIds.includes(item.id);
                return (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleCashInSourceToggle(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{item.description || item.name} ({item.category})</span>
                  </label>
                );
              })
            )}
          </div>
          <small style={{ marginTop: '5px', color: '#666' }}>
            Select income items to include as cash-in sources. If none selected, all income items will be included (default).
          </small>
        </div>
        <div className="form-group-horizontal" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <label htmlFor="cash-out-sources" style={{ marginBottom: '10px', fontWeight: 600 }}>
            Cash-Out Sources (for BASE Model and Sankey Diagram)
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gap: '8px', 
            width: '100%',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #ddd',
            padding: '10px',
            borderRadius: '4px'
          }}>
            {expenseItems.length === 0 ? (
              <span style={{ color: '#666', fontStyle: 'italic' }}>No expense items found. Add expense items first.</span>
            ) : (
              expenseItems.map((item) => {
                const isChecked = cashOutSourceIds.length === 0 || cashOutSourceIds.includes(item.id);
                return (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleCashOutSourceToggle(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{item.description || item.name} ({item.category})</span>
                  </label>
                );
              })
            )}
          </div>
          <small style={{ marginTop: '5px', color: '#666' }}>
            Select expense items to include as cash-out sources. If none selected, all expense items will be included (default).
          </small>
        </div>
        <div className="settings-page-actions">
          <button onClick={handleSave} className="save-button">Save</button>
          <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationSettingsPage;

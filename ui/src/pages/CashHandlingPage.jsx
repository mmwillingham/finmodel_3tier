import React, { useState, useEffect, useCallback } from 'react';
import SettingsService from '../services/settings.service';
import AssetService from '../services/asset.service';
import CashFlowService from '../services/cashflow.service';
import { useAuth } from '../context/AuthContext';
import { useSettingsContext } from '../context/SettingsContext.jsx';
import './SettingsPages.css';

const CashHandlingPage = () => {
  const { viewingUserId } = useAuth();
  const [cashAssetIds, setCashAssetIds] = useState([]);
  const [cashInSourceIds, setCashInSourceIds] = useState([]);
  const [cashOutSourceIds, setCashOutSourceIds] = useState([]);
  const [assets, setAssets] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { refreshSettings } = useSettingsContext();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, assetsRes, incomeRes, expenseRes] = await Promise.all([
        SettingsService.getSettings(viewingUserId),
        AssetService.list(viewingUserId || null).catch(() => ({ data: [] })),
        CashFlowService.list(true, viewingUserId).catch(() => ({ data: [] })),
        CashFlowService.list(false, viewingUserId).catch(() => ({ data: [] }))
      ]);
      setCashAssetIds(settingsRes.data.cash_asset_ids || []);
      setCashInSourceIds(settingsRes.data.cash_in_source_ids || []);
      setCashOutSourceIds(settingsRes.data.cash_out_source_ids || []);
      setAssets(assetsRes.data || []);
      setIncomeItems(incomeRes.data || []);
      setExpenseItems(expenseRes.data || []);
    } catch (e) {
      setError('Failed to load cash handling settings.');
    } finally {
      setLoading(false);
    }
  }, [viewingUserId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    try {
      setMessage('');
      setError(null);
      await SettingsService.updateSettings({
        cash_asset_ids: cashAssetIds,
        cash_in_source_ids: cashInSourceIds,
        cash_out_source_ids: cashOutSourceIds,
      });
      await refreshSettings();
      setMessage('Cash handling settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError('Failed to save cash handling settings: ' + (e.response?.data?.detail || e.message));
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
      if (prev.length === 0) {
        // If none selected (default to all), select all except this one
        const allIds = incomeItems.map(item => item.id);
        return allIds.filter(id => id !== itemId);
      } else if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleCashOutSourceToggle = (itemId) => {
    setCashOutSourceIds(prev => {
      if (prev.length === 0) {
        // If none selected (default to all), select all except this one
        const allIds = expenseItems.map(item => item.id);
        return allIds.filter(id => id !== itemId);
      } else if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading cash handling settings...</div>;
  }

  return (
    <div className="settings-page-container">
      <div className="settings-header">
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Cash Handling</h1>
        <p>Configure which assets and income/expense items are used for Cash Flow calculations.</p>
      </div>

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginBottom: '20px', color: '#c00' }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{ padding: '10px', backgroundColor: '#efe', border: '1px solid #cfc', borderRadius: '4px', marginBottom: '20px', color: '#0a0' }}>
          {message}
        </div>
      )}

      <div className="setting-group">
        <div className="form-group-horizontal" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <label htmlFor="cash-assets" style={{ marginBottom: '10px', fontWeight: 600 }}>
            Cash Assets (for Cash Flow Diagrams)
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
            {assets.length === 0 ? (
              <span style={{ color: '#666', fontStyle: 'italic' }}>No assets found. Add assets first.</span>
            ) : (
              assets.map((asset) => (
                <label key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cashAssetIds.includes(asset.id)}
                    onChange={() => handleCashAssetToggle(asset.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{asset.name} ({asset.category})</span>
                </label>
              ))
            )}
          </div>
          <small style={{ marginTop: '5px', color: '#666' }}>
            Select assets that should be considered as cash for the BASE Model and Sankey Diagram visualizations.
          </small>
        </div>

        <div className="form-group-horizontal" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <label htmlFor="cash-in-sources" style={{ marginBottom: '10px', fontWeight: 600 }}>
            Cash-In Sources (for Cash Flow Diagrams)
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
            Cash-Out Destinations (for Cash Flow Diagrams)
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
            Select expense items to include as cash-out destinations. If none selected, all expense items will be included (default).
          </small>
        </div>

        <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
          <button onClick={handleSave} className="btn-primary" style={{ padding: '10px 20px' }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashHandlingPage;

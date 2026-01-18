import React, { useState, useEffect } from "react";
import PlaidService from "../services/plaid.service";
import SettingsService from "../services/settings.service";
import "./PlaidAccountMappingModal.css";

/**
 * PlaidAccountMappingModal Component
 * 
 * Modal that allows users to map imported Plaid accounts to:
 * - Existing or new categories
 * - Assets or liabilities
 */
function PlaidAccountMappingModal({ itemId, accounts, onClose, onSuccess }) {
  const [mappings, setMappings] = useState([]);
  const [assetCategories, setAssetCategories] = useState([]);
  const [liabilityCategories, setLiabilityCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newCategoriesAdded, setNewCategoriesAdded] = useState({ assets: [], liabilities: [] }); // Track new categories added

  // Load categories from settings
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await SettingsService.getSettings();
        setAssetCategories(response.data.asset_categories || []);
        setLiabilityCategories(response.data.liability_categories || []);
      } catch (err) {
        console.error("Error loading categories:", err);
      }
    };
    loadCategories();
  }, []);

  // Initialize mappings from accounts
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const initialMappings = accounts.map(account => ({
        account_id: account.account_id,
        category: account.suggested_category,
        type: account.suggested_type, // 'asset' or 'liability'
        account_name: account.account_name,
        account_type: account.account_type,
        balance: account.balance,
        mask: account.mask
      }));
      setMappings(initialMappings);
    }
  }, [accounts]);

  const handleCategoryChange = (accountId, category) => {
    setMappings(mappings.map(m => 
      m.account_id === accountId 
        ? { ...m, category }
        : m
    ));
    setShowNewCategoryInput({ ...showNewCategoryInput, [accountId]: false });
  };

  const handleTypeChange = (accountId, type) => {
    setMappings(mappings.map(m => 
      m.account_id === accountId 
        ? { ...m, type }
        : m
    ));
  };

  const handleAddNewCategory = (accountId) => {
    const categoryName = newCategoryName[accountId];
    if (!categoryName || !categoryName.trim()) return;

    const mapping = mappings.find(m => m.account_id === accountId);
    if (!mapping) return;

    const trimmedName = categoryName.trim();
    
    // Add to appropriate category list and track new categories
    if (mapping.type === 'asset' && !assetCategories.includes(trimmedName)) {
      setAssetCategories([...assetCategories, trimmedName]);
      setNewCategoriesAdded(prev => ({
        ...prev,
        assets: [...prev.assets, trimmedName]
      }));
    } else if (mapping.type === 'liability' && !liabilityCategories.includes(trimmedName)) {
      setLiabilityCategories([...liabilityCategories, trimmedName]);
      setNewCategoriesAdded(prev => ({
        ...prev,
        liabilities: [...prev.liabilities, trimmedName]
      }));
    }

    // Update mapping with new category
    handleCategoryChange(accountId, trimmedName);
    setNewCategoryName({ ...newCategoryName, [accountId]: '' });
  };

  const handleApplyMappings = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, save any new categories to user settings
      if (newCategoriesAdded.assets.length > 0 || newCategoriesAdded.liabilities.length > 0) {
        try {
          const settingsResponse = await SettingsService.getSettings();
          const currentSettings = settingsResponse.data;
          
          const updatedSettings = {
            asset_categories: [
              ...(currentSettings.asset_categories || []),
              ...newCategoriesAdded.assets.filter(cat => !currentSettings.asset_categories?.includes(cat))
            ],
            liability_categories: [
              ...(currentSettings.liability_categories || []),
              ...newCategoriesAdded.liabilities.filter(cat => !currentSettings.liability_categories?.includes(cat))
            ]
          };
          
          await SettingsService.updateSettings(updatedSettings);
        } catch (settingsErr) {
          console.error("Error saving new categories to settings:", settingsErr);
          // Don't fail the whole operation if settings save fails, but log it
        }
      }

      // Then apply the mappings
      const mappingsToSend = mappings.map(m => ({
        account_id: m.account_id,
        category: m.category,
        type: m.type
      }));

      const response = await PlaidService.applyMappings(itemId, mappingsToSend);
      
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      onClose();
    } catch (err) {
      console.error("Error applying mappings:", err);
      setError(err.response?.data?.detail || "Failed to apply mappings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(v ?? 0);

  if (!accounts || accounts.length === 0) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content plaid-mapping-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Map Imported Accounts</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Review and map the imported accounts. Credit cards should typically be mapped as liabilities.
          </p>

          {error && (
            <div className="error-message" style={{ 
              padding: '12px', 
              backgroundColor: '#fee', 
              border: '1px solid #fcc', 
              borderRadius: '4px',
              marginBottom: '20px',
              color: '#c00'
            }}>
              {error}
            </div>
          )}

          <table className="mapping-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Account</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Balance</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Type</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => {
                const availableCategories = mapping.type === 'asset' ? assetCategories : liabilityCategories;
                const isCredit = mapping.account_type === 'credit';

                return (
                  <tr key={mapping.account_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: '500' }}>{mapping.account_name}</div>
                      {mapping.mask && (
                        <div style={{ fontSize: '0.85em', color: '#666' }}>****{mapping.mask}</div>
                      )}
                      <div style={{ fontSize: '0.8em', color: '#999' }}>{mapping.account_type}</div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      {formatCurrency(mapping.balance)}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <select
                        value={mapping.type}
                        onChange={(e) => handleTypeChange(mapping.account_id, e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          width: '100%'
                        }}
                      >
                        <option value="asset">Asset</option>
                        <option value="liability">Liability</option>
                      </select>
                      {isCredit && mapping.type === 'asset' && (
                        <div style={{ fontSize: '0.75em', color: '#f66', marginTop: '4px' }}>
                          ⚠️ Credit cards should be liabilities
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {showNewCategoryInput[mapping.account_id] ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={newCategoryName[mapping.account_id] || ''}
                            onChange={(e) => setNewCategoryName({ ...newCategoryName, [mapping.account_id]: e.target.value })}
                            placeholder="New category name"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              flex: 1
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddNewCategory(mapping.account_id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddNewCategory(mapping.account_id)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: '#28a745',
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setShowNewCategoryInput({ ...showNewCategoryInput, [mapping.account_id]: false })}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select
                            value={mapping.category}
                            onChange={(e) => handleCategoryChange(mapping.account_id, e.target.value)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              flex: 1
                            }}
                          >
                            {availableCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setShowNewCategoryInput({ ...showNewCategoryInput, [mapping.account_id]: true })}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: '#007bff',
                              color: 'white',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            + New
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-footer" style={{ 
          padding: '20px', 
          borderTop: '1px solid #ddd', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '10px' 
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApplyMappings}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Applying...' : 'Apply Mappings'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlaidAccountMappingModal;

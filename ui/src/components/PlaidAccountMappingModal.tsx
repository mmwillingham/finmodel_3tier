import React, { useState, useEffect } from "react";
import PlaidService from "../services/plaid.service";
import SettingsService from "../services/settings.service";
import { useSettingsContext } from "../context/SettingsContext";
import "./PlaidAccountMappingModal.css";

type MappingType = 'asset' | 'liability';

interface PlaidAccount {
  account_id: string;
  suggested_type: MappingType;
  suggested_category: string;
  account_name: string;
  account_type: string;
  account_subtype?: string;
  balance?: number;
  mask?: string;
  [key: string]: any;
}

interface AccountMapping {
  account_id: string;
  category: string;
  type: MappingType;
  account_name: string;
  account_type: string;
  account_subtype?: string;
  balance?: number;
  mask?: string;
}

interface PlaidAccountMappingModalProps {
  itemId: string | number;
  accounts: PlaidAccount[];
  onClose: () => void;
  onSuccess?: (data: any) => void;
}

/**
 * PlaidAccountMappingModal Component
 * 
 * Modal that allows users to map imported Plaid accounts to:
 * - Existing or new categories
 * - Assets or liabilities
 */
function PlaidAccountMappingModal({ itemId, accounts, onClose, onSuccess }: PlaidAccountMappingModalProps) {
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [assetCategories, setAssetCategories] = useState<string[]>([]);
  const [liabilityCategories, setLiabilityCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategoriesAdded, setNewCategoriesAdded] = useState<{ assets: string[]; liabilities: string[] }>({ assets: [], liabilities: [] }); // Track new categories added
  const { settings, refreshSettings } = useSettingsContext();

  // Load categories from settings
  useEffect(() => {
    if (!settings) {
      return;
    }
    const typedSettings = settings as any;
    setAssetCategories((typedSettings.asset_categories || []) as string[]);
    setLiabilityCategories((typedSettings.liability_categories || []) as string[]);
  }, [settings]);

  // Initialize mappings from accounts
  useEffect(() => {
    if (accounts && accounts.length > 0 && (assetCategories.length > 0 || liabilityCategories.length > 0)) {
      const initialMappings = accounts.map((account: PlaidAccount) => {
        const availableCats = account.suggested_type === 'asset' ? assetCategories : liabilityCategories;
        let category = account.suggested_category;
        
        // If suggested category is not in user's category list, try to find a better match
        if (!availableCats.includes(category)) {
          // Try to match based on account subtype for better defaults
          if (account.account_type === 'depository') {
            const accountSubtype = (account.account_subtype || '').toLowerCase();
            if (accountSubtype === 'checking' && availableCats.includes('Checking')) {
              category = 'Checking';
            } else if (accountSubtype === 'savings' && availableCats.includes('Savings')) {
              category = 'Savings';
            } else if (availableCats.length > 0) {
              // Fall back to first available category
              category = availableCats[0];
            }
          } else if (availableCats.length > 0) {
            // For other types, use first available category
            category = availableCats[0];
          }
        } else {
          // Category is already in user's list, keep it
        }
        
        return {
          account_id: account.account_id,
          category: category, // This is what will be sent to backend
          type: account.suggested_type, // 'asset' or 'liability'
          account_name: account.account_name,
          account_type: account.account_type,
          account_subtype: account.account_subtype, // Store for debugging
          balance: account.balance,
          mask: account.mask
        };
      });
      setMappings(initialMappings);
    }
  }, [accounts, assetCategories, liabilityCategories]);

  const handleCategoryChange = (accountId: string, category: string) => {
    setMappings(mappings.map((m: AccountMapping) =>
      m.account_id === accountId 
        ? { ...m, category }
        : m
    ));
    setShowNewCategoryInput({ ...showNewCategoryInput, [accountId]: false });
  };

  const handleTypeChange = (accountId: string, type: string) => {
    setMappings(mappings.map((m: AccountMapping) =>
      m.account_id === accountId 
        ? { ...m, type: type as MappingType }
        : m
    ));
  };

  const handleAddNewCategory = (accountId: string) => {
    const categoryName = newCategoryName[accountId];
    if (!categoryName || !categoryName.trim()) return;

    const mapping = mappings.find((m: AccountMapping) => m.account_id === accountId);
    if (!mapping) return;

    const trimmedName = categoryName.trim();
    
    // Add to appropriate category list and track new categories
    if (mapping.type === 'asset' && !assetCategories.includes(trimmedName)) {
      setAssetCategories([...assetCategories, trimmedName]);
      setNewCategoriesAdded((prev: any) => ({
        ...prev,
        assets: [...prev.assets, trimmedName]
      }));
    } else if (mapping.type === 'liability' && !liabilityCategories.includes(trimmedName)) {
      setLiabilityCategories([...liabilityCategories, trimmedName]);
      setNewCategoriesAdded((prev: any) => ({
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
          const currentSettings = (settings as any) || {};
          const updatedSettings = {
            asset_categories: [
              ...(currentSettings.asset_categories || []),
              ...newCategoriesAdded.assets.filter((cat: any) => !currentSettings.asset_categories?.includes(cat))
            ],
            liability_categories: [
              ...(currentSettings.liability_categories || []),
              ...newCategoriesAdded.liabilities.filter((cat: any) => !currentSettings.liability_categories?.includes(cat))
            ]
          };
          
          await SettingsService.updateSettings(updatedSettings);
          await refreshSettings();
        } catch (_settingsErr) {
          // Don't fail the whole operation if settings save fails, but log it
        }
      }

      // Then apply the mappings - ensure we send exactly what's in the mapping state
      const mappingsToSend = mappings.map((m: AccountMapping) => {
        // Log what we're sending for debugging
        return {
          account_id: m.account_id,
          category: m.category, // Send the actual category from the mapping state
          type: m.type
        };
      });

      const response = await PlaidService.applyMappings(String(itemId), mappingsToSend);
      
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to apply mappings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number | string | null | undefined) =>
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(Number(v ?? 0));

  if (!accounts || accounts.length === 0) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content plaid-mapping-modal" onClick={(e: any) => e.stopPropagation()}>
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
              {mappings.map((mapping: AccountMapping) => {
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
                        onChange={(e: any) => handleTypeChange(mapping.account_id, e.target.value)}
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
                            onChange={(e: any) => setNewCategoryName({ ...newCategoryName, [mapping.account_id]: e.target.value })}
                            placeholder="New category name"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              flex: 1
                            }}
                            onKeyPress={(e: any) => {
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
                            value={mapping.category || ''}
                            onChange={(e: any) => handleCategoryChange(mapping.account_id, e.target.value)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              flex: 1
                            }}
                          >
                            {/* Always include the current category in options, even if not in user's list */}
                            {!availableCategories.includes(mapping.category) && mapping.category && (
                              <option key={mapping.category} value={mapping.category}>{mapping.category}</option>
                            )}
                            {[...availableCategories].sort().map((cat: string) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setShowNewCategoryInput({ ...showNewCategoryInput, [mapping.account_id]: true })}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '4px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #0F2847 0%, #00a3e0 100%)',
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

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AutoDisbursementService from '../services/auto_disbursement.service';
import AssetService from '../services/asset.service';
import SettingsService from '../services/settings.service';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import './SettingsPages.css';

const AutoDisbursementSettingsPage = () => {
  const { currentUser, viewingUserId } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton();
  const [autoDisbursements, setAutoDisbursements] = useState([]);
  const [assets, setAssets] = useState([]);
  const [surplusAssetId, setSurplusAssetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [editingAutoDisbursement, setEditingAutoDisbursement] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [activeTab, setActiveTab] = useState('surplus'); // 'surplus' or 'disbursements'
  const [newAutoDisbursement, setNewAutoDisbursement] = useState({
    name: '',
    source_asset_id: null,
    target_asset_id: null,
    transfer_type: 'percentage',
    transfer_value: '',
    start_date: '',
    end_date: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [autoDisbursementsData, assetsRes, settingsRes] = await Promise.all([
        AutoDisbursementService.getAllAutoDisbursements().catch((err) => {
          console.error('Error loading auto-disbursements:', err);
          return [];
        }),
        AssetService.list(viewingUserId || null).catch((err) => {
          console.error('Error loading assets:', err);
          return { data: [] };
        }),
        SettingsService.getSettings().catch((err) => {
          console.error('Error loading settings:', err);
          return { data: {} };
        }),
      ]);
      console.log('Auto-disbursements loaded:', autoDisbursementsData);
      console.log('Assets response:', assetsRes);
      console.log('Assets data:', assetsRes?.data);
      setAutoDisbursements(autoDisbursementsData || []);
      setAssets(assetsRes?.data || []);
      setSurplusAssetId(settingsRes.data.surplus_asset_id || null);
    } catch (e) {
      console.error('Failed to load data', e);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateAutoDisbursement = async () => {
    if (!newAutoDisbursement.name || !newAutoDisbursement.source_asset_id || !newAutoDisbursement.target_asset_id) {
      setMessage('Error: Name, Source Asset, and Target Asset are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (newAutoDisbursement.source_asset_id === newAutoDisbursement.target_asset_id) {
      setMessage('Error: Source Asset and Target Asset cannot be the same');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const transferValue = parseFloat(newAutoDisbursement.transfer_value);
    if (isNaN(transferValue) || transferValue <= 0) {
      setMessage('Error: Transfer Value must be a positive number');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (newAutoDisbursement.transfer_type === 'percentage' && transferValue > 100) {
      setMessage('Error: Percentage cannot exceed 100%');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      await AutoDisbursementService.createAutoDisbursement({
        ...newAutoDisbursement,
        source_asset_id: parseInt(newAutoDisbursement.source_asset_id),
        target_asset_id: parseInt(newAutoDisbursement.target_asset_id),
        transfer_value: transferValue,
        start_date: newAutoDisbursement.start_date || null,
        end_date: newAutoDisbursement.end_date || null,
      });
      setMessage('Auto-disbursement created successfully!');
      setNewAutoDisbursement({
        name: '',
        source_asset_id: null,
        target_asset_id: null,
        transfer_type: 'percentage',
        transfer_value: '',
        start_date: '',
        end_date: '',
      });
      loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to create auto-disbursement', e);
      const errorMessage = e.response?.data?.detail || 'Error creating auto-disbursement';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleUpdateAutoDisbursement = async (id, updatedAutoDisbursement) => {
    if (!updatedAutoDisbursement.name || !updatedAutoDisbursement.source_asset_id || !updatedAutoDisbursement.target_asset_id) {
      setMessage('Error: Name, Source Asset, and Target Asset are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (updatedAutoDisbursement.source_asset_id === updatedAutoDisbursement.target_asset_id) {
      setMessage('Error: Source Asset and Target Asset cannot be the same');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const transferValue = parseFloat(updatedAutoDisbursement.transfer_value);
    if (isNaN(transferValue) || transferValue <= 0) {
      setMessage('Error: Transfer Value must be a positive number');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (updatedAutoDisbursement.transfer_type === 'percentage' && transferValue > 100) {
      setMessage('Error: Percentage cannot exceed 100%');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      await AutoDisbursementService.updateAutoDisbursement(id, {
        ...updatedAutoDisbursement,
        source_asset_id: parseInt(updatedAutoDisbursement.source_asset_id),
        target_asset_id: parseInt(updatedAutoDisbursement.target_asset_id),
        transfer_value: transferValue,
        start_date: updatedAutoDisbursement.start_date || null,
        end_date: updatedAutoDisbursement.end_date || null,
      });
      setMessage('Auto-disbursement updated successfully!');
      setEditingAutoDisbursement(null);
      loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to update auto-disbursement', e);
      const errorMessage = e.response?.data?.detail || 'Error updating auto-disbursement';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteAutoDisbursement = async (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Auto-Disbursement',
      message: 'Are you sure you want to delete this auto-disbursement?',
      onConfirm: async () => {
        try {
          await AutoDisbursementService.deleteAutoDisbursement(id);
          setMessage('Auto-disbursement deleted successfully!');
          loadData();
          setTimeout(() => setMessage(''), 2000);
        } catch (e) {
          console.error('Failed to delete auto-disbursement', e);
          const errorMessage = e.response?.data?.detail || 'Error deleting auto-disbursement';
          setMessage(errorMessage);
          setTimeout(() => setMessage(''), 3000);
        }
      }
    });
  };

  const getAssetName = (assetId) => {
    const asset = assets.find(a => a.id === assetId);
    return asset ? `${asset.name} (${asset.category})` : 'Unknown Asset';
  };

  const handleSaveSurplusAsset = async () => {
    setMessage('');
    try {
      await SettingsService.updateSettings({
        surplus_asset_id: surplusAssetId || null,
      });
      setMessage('Surplus Asset saved successfully!');
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to save surplus asset', e);
      const errorMessage = e.response?.data?.detail || 'Error saving surplus asset';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return <div className="loading-message">Loading automatic transfers...</div>;
  }

  return (
    <div className="settings-page-container auto-disbursements-page">
      <h2>Automatic Transfers</h2>
      {message && <div className={`message ${message.includes('Error') ? 'error' : ''}`}>{message}</div>}

      {assets.length === 0 && !loading && (
        <div className="message" style={{ marginBottom: '20px', backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7' }}>
          <strong>Note:</strong> No assets found. Please create assets first before setting up automatic transfers.
        </div>
      )}

      {/* Tabs */}
      <div className="settings-tabs" style={{ marginBottom: '20px', borderBottom: '2px solid #eee' }}>
        <button
          className={activeTab === 'surplus' ? 'active' : ''}
          onClick={() => setActiveTab('surplus')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '10px 20px',
            fontSize: '1.1em',
            cursor: 'pointer',
            color: activeTab === 'surplus' ? '#007bff' : '#555',
            borderBottom: activeTab === 'surplus' ? '2px solid #007bff' : '2px solid transparent',
            fontWeight: activeTab === 'surplus' ? 'bold' : 'normal',
            transition: 'all 0.3s ease'
          }}
        >
          Surplus Asset
        </button>
        <button
          className={activeTab === 'disbursements' ? 'active' : ''}
          onClick={() => setActiveTab('disbursements')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '10px 20px',
            fontSize: '1.1em',
            cursor: 'pointer',
            color: activeTab === 'disbursements' ? '#007bff' : '#555',
            borderBottom: activeTab === 'disbursements' ? '2px solid #007bff' : '2px solid transparent',
            fontWeight: activeTab === 'disbursements' ? 'bold' : 'normal',
            transition: 'all 0.3s ease'
          }}
        >
          Auto-Disbursements
        </button>
      </div>

      {/* Surplus Asset Tab */}
      {activeTab === 'surplus' && (
        <div className="setting-group card-modern" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.1em' }}>Surplus Asset</h3>
          <div className="form-row" style={{ gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'flex-start' }}>
            <div className="form-field">
              <label htmlFor="surplus-asset">Surplus Asset</label>
              <select
                id="surplus-asset"
                value={surplusAssetId || ''}
                onChange={(e) => setSurplusAssetId(e.target.value ? parseInt(e.target.value) : null)}
                className="input-modern"
              >
                <option value="">None (No automatic surplus/deficit handling)</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.category})
                  </option>
                ))}
              </select>
              <small style={{ color: '#666', fontSize: '0.85em', marginTop: '6px', display: 'block' }}>
                Select an asset account where cash flow surplus/deficit will be automatically added or subtracted each year.
              </small>
            </div>
            <button onClick={handleSaveSurplusAsset} className="btn-primary-modern" style={{ marginTop: '24px', padding: '10px 24px', whiteSpace: 'nowrap' }}>
              Save
            </button>
          </div>
          <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f0f7ff', border: '1px solid #b3d9ff', borderRadius: '4px', fontSize: '0.9em', color: '#004085' }}>
            <strong>Transfer Sequence:</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li><strong>Auto-Disbursements</strong> are applied at the <strong>beginning of each year</strong>, before asset growth</li>
              <li><strong>Surplus/Deficit Transfer</strong> is applied at the <strong>end of each year</strong>, after asset growth</li>
              <li>Sequence: <strong>Auto-Disbursements</strong> → <strong>Asset Growth</strong> → <strong>Surplus/Deficit Transfer</strong></li>
              <li>This ensures auto-disbursements benefit from growth, while surplus/deficit represents end-of-year cash flow</li>
            </ul>
          </div>
        </div>
      )}

      {/* Auto-Disbursements Tab */}
      {activeTab === 'disbursements' && (
        <div className="setting-group card-modern" style={{ display: 'block', marginBottom: '20px' }}>
          {/* Form Section - Top */}
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1em' }}>
            Auto-Disbursements {assets.length > 0 && <span style={{ fontSize: '0.85em', color: '#666', fontWeight: 'normal' }}>({assets.length} assets available)</span>}
          </h3>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
              <div className="form-field">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g. IRA to Savings"
                  value={newAutoDisbursement.name}
                  onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, name: e.target.value })}
                  className="input-modern"
                />
              </div>
              <div className="form-field">
                <label htmlFor="transfer_type">Transfer Type *</label>
                <select
                  id="transfer_type"
                  value={newAutoDisbursement.transfer_type}
                  onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, transfer_type: e.target.value })}
                  className="input-modern"
                >
                  <option value="percentage">Percentage</option>
                  <option value="dollar_amount">Dollar Amount</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="source_asset_id">Source Asset *</label>
                <select
                  id="source_asset_id"
                  value={newAutoDisbursement.source_asset_id || ''}
                  onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, source_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="input-modern"
                >
                  <option value="">Select Source Asset</option>
                  {assets && assets.length > 0 ? (
                    assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} ({asset.category})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No assets available</option>
                  )}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="target_asset_id">Target Asset *</label>
                <select
                  id="target_asset_id"
                  value={newAutoDisbursement.target_asset_id || ''}
                  onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, target_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="input-modern"
                >
                  <option value="">Select Target Asset</option>
                  {assets && assets.length > 0 ? (
                    assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} ({asset.category})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No assets available</option>
                  )}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="transfer_value">
                  Transfer Value * ({newAutoDisbursement.transfer_type === 'percentage' ? '%' : '$'}/year)
                </label>
                <input
                  id="transfer_value"
                  type="number"
                  step={newAutoDisbursement.transfer_type === 'percentage' ? '0.1' : '0.01'}
                  placeholder={newAutoDisbursement.transfer_type === 'percentage' ? 'e.g., 5' : 'e.g., 5000'}
                  value={newAutoDisbursement.transfer_value}
                  onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, transfer_value: e.target.value })}
                  className="input-modern"
                />
              </div>
              <div className="form-field">
                <label htmlFor="start_date">Start Date</label>
                <input
                  id="start_date"
                  type="date"
                  value={newAutoDisbursement.start_date}
                  onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, start_date: e.target.value })}
                  className="input-modern"
                />
                <small style={{ color: '#666', fontSize: '0.8em', marginTop: '3px', display: 'block' }}>Optional</small>
              </div>
              <div className="form-field">
                <label htmlFor="end_date">End Date</label>
                <input
                  id="end_date"
                  type="date"
                  value={newAutoDisbursement.end_date}
                  onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, end_date: e.target.value })}
                  className="input-modern"
                />
                <small style={{ color: '#666', fontSize: '0.8em', marginTop: '3px', display: 'block' }}>Optional</small>
              </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '12px', marginBottom: '30px' }}>
            <button onClick={handleCreateAutoDisbursement} className="btn-primary-modern">
              Add Auto-Disbursement
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #eee', marginTop: '30px', marginBottom: '20px' }}></div>

          {/* Transfer Sequence Note */}
          <div style={{ marginTop: '20px', marginBottom: '20px', padding: '12px', backgroundColor: '#f0f7ff', border: '1px solid #b3d9ff', borderRadius: '4px', fontSize: '0.9em', color: '#004085' }}>
            <strong>Transfer Sequence:</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li><strong>Auto-Disbursements</strong> are applied at the <strong>beginning of each year</strong>, before asset growth</li>
              <li><strong>Surplus/Deficit Transfer</strong> is applied at the <strong>end of each year</strong>, after asset growth</li>
              <li>Sequence: <strong>Auto-Disbursements</strong> → <strong>Asset Growth</strong> → <strong>Surplus/Deficit Transfer</strong></li>
              <li>This ensures auto-disbursements benefit from growth, while surplus/deficit represents end-of-year cash flow</li>
            </ul>
          </div>

          {/* Existing List Section - Bottom */}
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.1em' }}>
            Existing Auto-Disbursements
          </h3>
        {autoDisbursements.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
            No auto-disbursements defined. Add an auto-disbursement above.
          </p>
        ) : (
          <div style={{ width: '100%', marginTop: '10px', overflowX: 'auto', overflowY: 'visible' }}>
            <table className="accounts-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontSize: '0.9em', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Name</th>
                <th style={{ width: '18%' }}>Source Asset</th>
                <th style={{ width: '18%' }}>Target Asset</th>
                <th style={{ width: '10%' }}>Type</th>
                <th style={{ width: '12%' }}>Value</th>
                <th style={{ width: '12%' }}>Start Date</th>
                <th style={{ width: '12%' }}>End Date</th>
                <th style={{ width: '3%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {autoDisbursements.map((ad) => (
                <tr key={ad.id}>
                  {editingAutoDisbursement?.id === ad.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editingAutoDisbursement.name}
                          onChange={(e) => setEditingAutoDisbursement({ ...editingAutoDisbursement, name: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <select
                          value={editingAutoDisbursement.source_asset_id || ''}
                          onChange={(e) => setEditingAutoDisbursement({ ...editingAutoDisbursement, source_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                          style={{ width: '100%', padding: '5px' }}
                        >
                          <option value="">Select Source Asset</option>
                          {assets.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={editingAutoDisbursement.target_asset_id || ''}
                          onChange={(e) => setEditingAutoDisbursement({ ...editingAutoDisbursement, target_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                          style={{ width: '100%', padding: '5px' }}
                        >
                          <option value="">Select Target Asset</option>
                          {assets.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={editingAutoDisbursement.transfer_type}
                          onChange={(e) => setEditingAutoDisbursement({ ...editingAutoDisbursement, transfer_type: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="dollar_amount">Dollar Amount</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            step={editingAutoDisbursement.transfer_type === 'percentage' ? '0.1' : '0.01'}
                            value={editingAutoDisbursement.transfer_value}
                            onChange={(e) => setEditingAutoDisbursement({ ...editingAutoDisbursement, transfer_value: e.target.value })}
                            style={{ width: '100%', padding: '5px' }}
                          />
                          <span style={{ fontSize: '0.85em', color: '#666', whiteSpace: 'nowrap' }}>
                            /year {editingAutoDisbursement.transfer_type === 'percentage' ? '%' : '$'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="date"
                          value={editingAutoDisbursement.start_date || ''}
                          onChange={(e) => setEditingAutoDisbursement({ ...editingAutoDisbursement, start_date: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={editingAutoDisbursement.end_date || ''}
                          onChange={(e) => setEditingAutoDisbursement({ ...editingAutoDisbursement, end_date: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <button onClick={() => handleUpdateAutoDisbursement(ad.id, editingAutoDisbursement)} className="save-button" style={{ padding: '5px 10px', marginRight: '5px' }}>
                          Save
                        </button>
                        <button onClick={() => setEditingAutoDisbursement(null)} className="cancel-button" style={{ padding: '5px 10px' }}>
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>{ad.name}</td>
                      <td style={{ wordWrap: 'break-word', overflowWrap: 'break-word', fontSize: '0.9em' }}>{getAssetName(ad.source_asset_id)}</td>
                      <td style={{ wordWrap: 'break-word', overflowWrap: 'break-word', fontSize: '0.9em' }}>{getAssetName(ad.target_asset_id)}</td>
                      <td>{ad.transfer_type === 'percentage' ? 'Pct' : '$'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{ad.transfer_type === 'percentage' ? `${ad.transfer_value}%` : `$${ad.transfer_value.toLocaleString()}`}/yr</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.9em' }}>{ad.start_date ? new Date(ad.start_date).toLocaleDateString() : '-'}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.9em' }}>{ad.end_date ? new Date(ad.end_date).toLocaleDateString() : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button onClick={() => setEditingAutoDisbursement({ ...ad })} className="edit-icon-btn" title="Edit">
                            <span role="img" aria-label="edit">✏️</span>
                          </button>
                          <button onClick={() => handleDeleteAutoDisbursement(ad.id)} className="delete-icon-btn" title="Delete">
                            <span role="img" aria-label="delete">🗑️</span>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </div>
      )}

      <div className="settings-page-actions" style={{ marginTop: '20px' }}>
        <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, title: '' })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
};

export default AutoDisbursementSettingsPage;


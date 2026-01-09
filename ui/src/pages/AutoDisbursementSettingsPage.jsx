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

      {/* Surplus Asset Section */}
      <div className="setting-group" style={{ marginBottom: '30px' }}>
        <h3 style={{ color: 'var(--color-heading)', marginBottom: '15px', fontSize: '1.1em', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
          Surplus Asset
        </h3>
        <div className="profile-settings-form">
          <div className="form-group-horizontal">
            <label htmlFor="surplus-asset" style={{ minWidth: '140px' }}>
              Surplus Asset
            </label>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select
                id="surplus-asset"
                value={surplusAssetId || ''}
                onChange={(e) => setSurplusAssetId(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: '100%', maxWidth: '400px', textAlign: 'left' }}
              >
                <option value="">None (No automatic surplus/deficit handling)</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.category})
                  </option>
                ))}
              </select>
              <small style={{ color: '#666', fontSize: '0.85em' }}>
                Select an asset account where cash flow surplus/deficit will be automatically added or subtracted each year.
              </small>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '15px' }}>
          <button onClick={handleSaveSurplusAsset} className="save-button">
            Save Surplus Asset
          </button>
        </div>
      </div>

      {/* Auto-Disbursements Section */}
      <div className="setting-group" style={{ marginBottom: '30px' }}>
        <h3 style={{ color: 'var(--color-heading)', marginBottom: '15px', fontSize: '1.1em', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
          Auto-Disbursements {assets.length > 0 && <span style={{ fontSize: '0.85em', color: '#666', fontWeight: 'normal' }}>({assets.length} assets available)</span>}
        </h3>
        <h4 style={{ fontSize: '0.95em', color: '#666', marginBottom: '12px', fontWeight: '500' }}>Add New Auto-Disbursement</h4>
        <div className="profile-settings-form">
          <div className="form-group-horizontal">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. IRA to Savings"
              value={newAutoDisbursement.name}
              onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, name: e.target.value })}
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="transfer_type">Transfer Type *</label>
            <select
              id="transfer_type"
              value={newAutoDisbursement.transfer_type}
              onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, transfer_type: e.target.value })}
            >
              <option value="percentage">Percentage</option>
              <option value="dollar_amount">Dollar Amount</option>
            </select>
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="source_asset_id" style={{ minWidth: '140px' }}>Source Asset *</label>
            <select
              id="source_asset_id"
              value={newAutoDisbursement.source_asset_id || ''}
              onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, source_asset_id: e.target.value ? parseInt(e.target.value) : null })}
              style={{ width: '100%', maxWidth: '400px', textAlign: 'left' }}
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
          <div className="form-group-horizontal">
            <label htmlFor="target_asset_id" style={{ minWidth: '140px' }}>Target Asset *</label>
            <select
              id="target_asset_id"
              value={newAutoDisbursement.target_asset_id || ''}
              onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, target_asset_id: e.target.value ? parseInt(e.target.value) : null })}
              style={{ width: '100%', maxWidth: '400px', textAlign: 'left' }}
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
          <div className="form-group-horizontal">
            <label htmlFor="transfer_value" style={{ minWidth: '140px' }}>
              Transfer Value per year * ({newAutoDisbursement.transfer_type === 'percentage' ? '%' : '$'})
            </label>
            <input
              id="transfer_value"
              type="number"
              step={newAutoDisbursement.transfer_type === 'percentage' ? '0.1' : '0.01'}
              placeholder={newAutoDisbursement.transfer_type === 'percentage' ? 'e.g., 5' : 'e.g., 5000'}
              value={newAutoDisbursement.transfer_value}
              onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, transfer_value: e.target.value })}
              style={{ width: '150px', textAlign: 'right' }}
            />
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="start_date" style={{ minWidth: '140px' }}>Start Date</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
              <input
                id="start_date"
                type="date"
                value={newAutoDisbursement.start_date}
                onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, start_date: e.target.value })}
                style={{ width: '150px' }}
              />
              <small style={{ fontSize: '0.75em', color: '#666' }}>Optional - leave blank to start immediately</small>
            </div>
          </div>
          <div className="form-group-horizontal">
            <label htmlFor="end_date" style={{ minWidth: '140px' }}>End Date</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
              <input
                id="end_date"
                type="date"
                value={newAutoDisbursement.end_date}
                onChange={(e) => setNewAutoDisbursement({ ...newAutoDisbursement, end_date: e.target.value })}
                style={{ width: '150px' }}
              />
              <small style={{ fontSize: '0.75em', color: '#666' }}>Optional - leave blank to continue indefinitely</small>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '15px' }}>
          <button onClick={handleCreateAutoDisbursement} className="save-button">
            Add Auto-Disbursement
          </button>
        </div>
      </div>

      <div className="setting-group" style={{ marginTop: '30px' }}>
        <h3 style={{ color: 'var(--color-heading)', marginBottom: '15px', fontSize: '1.1em', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
          Existing Auto-Disbursements
        </h3>
        {autoDisbursements.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
            No auto-disbursements defined. Add an auto-disbursement above.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%', marginTop: '10px' }}>
            <table className="accounts-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Source Asset</th>
                <th>Target Asset</th>
                <th>Transfer Type</th>
                <th>Transfer Value</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Actions</th>
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
                      <td>{ad.name}</td>
                      <td>{getAssetName(ad.source_asset_id)}</td>
                      <td>{getAssetName(ad.target_asset_id)}</td>
                      <td>{ad.transfer_type === 'percentage' ? 'Percentage' : 'Dollar Amount'}</td>
                      <td>{ad.transfer_type === 'percentage' ? `${ad.transfer_value}%` : `$${ad.transfer_value.toLocaleString()}`} per year</td>
                      <td>{ad.start_date || '-'}</td>
                      <td>{ad.end_date || '-'}</td>
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

      <div className="settings-page-actions">
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


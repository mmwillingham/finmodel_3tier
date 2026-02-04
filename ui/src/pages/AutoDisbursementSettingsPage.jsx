import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AutoDisbursementService from '../services/auto_disbursement.service';
import AssetService from '../services/asset.service';
import SettingsService from '../services/settings.service';
import AccountService from '../services/account.service';
import { useSettingsContext } from '../context/SettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import './SettingsPages.css';

const AutoDisbursementSettingsPage = () => {
  // Simple error boundary to catch render/runtime errors and display them in the UI.
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null, info: null };
    }
    componentDidCatch(error, info) {
      // Save to state and log to console for debugging
      this.setState({ hasError: true, error, info });
      // eslint-disable-next-line no-console
      console.error('AutoDisbursementSettingsPage render error', error, info);
    }
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ padding: 20, background: '#fff3f3', border: '1px solid #f5c2c2', borderRadius: 6 }}>
            <strong style={{ color: '#a00' }}>An error occurred rendering Auto-Disbursements</strong>
            <div style={{ marginTop: 8, color: '#333' }}>{this.state.error && this.state.error.toString()}</div>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#555' }}>{this.state.info?.componentStack}</pre>
            <div style={{ marginTop: 8 }}>
              Please copy the above error and send it to the developer console if asked.
            </div>
          </div>
          
        );
      }
      return this.props.children;
    }
  }
  const { currentUser, viewingUserId } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton();
  const [autoDisbursements, setAutoDisbursements] = useState([]);
  const [assets, setAssets] = useState([]);
  const [accounts, setAccounts] = useState([]);
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
    distribution_type: 'non_taxable',
    transfer_type: 'percentage',
    transfer_value: '',
    start_date: '',
    end_date: '',
    use_rmd: false,
    rmd_overrides: {},
  });
  // RMD schedule and per-year overrides
  const [rmdSchedule, setRmdSchedule] = useState(null);
  const [userSettings, setUserSettings] = useState({});
  const [editingId, setEditingId] = useState(null);
  const isViewingOther = viewingUserId && viewingUserId !== currentUser?.id;
  const { refreshSettings } = useSettingsContext();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
    const [autoDisbursementsData, assetsRes, accountsRes, settingsRes] = await Promise.all([
        AutoDisbursementService.getAllAutoDisbursements(viewingUserId).catch((err) => {
          return [];
        }),
        AssetService.list(viewingUserId || null).catch((err) => {
          return { data: [] };
        }),
        // Load accounts to determine retirement flags for filtering
      AccountService.getAllAccounts(viewingUserId).catch((err) => {
          return [];
        }),
        SettingsService.getSettings(viewingUserId).catch((err) => {
          return { data: {} };
        }),
      ]);
      setAutoDisbursements(autoDisbursementsData || []);
      setAssets(assetsRes?.data || []);
      setAccounts(accountsRes || []);
      setSurplusAssetId(settingsRes.data.surplus_asset_id || null);
      // Save user settings for birthdate/tax year etc.
      setUserSettings(settingsRes.data || {});
    } catch (e) {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [viewingUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // RMD states
  const [recommendedRmd, setRecommendedRmd] = useState(null);
  const [rmdLoading, setRmdLoading] = useState(false);
  const [rmdError, setRmdError] = useState('');
  const nameRef = useRef(null);
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const transferValueRef = useRef(null);

  // Helper to normalize error-like values into a string for display
  const formatError = (err) => {
    if (!err && err !== '') return '';
    if (typeof err === 'string') return err;
    if (Array.isArray(err)) {
      return err.map((e) => {
        if (!e) return String(e);
        if (typeof e === 'string') return e;
        if (e.msg) return e.msg;
        if (e.detail) return typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail);
        return JSON.stringify(e);
      }).join('; ');
    }
    if (typeof err === 'object') {
      if (err.detail) return typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
      if (err.msg) return err.msg;
      return JSON.stringify(err);
    }
    return String(err);
  };

  useEffect(() => {
    const fetchRmd = async () => {
      setRecommendedRmd(null);
      setRmdError('');
      setRmdSchedule(null);
      if (newAutoDisbursement.distribution_type !== 'taxable_ira' || !newAutoDisbursement.source_asset_id) {
        return;
      }
      try {
        setRmdLoading(true);
        const startYear = (userSettings && userSettings.tax_year) ? userSettings.tax_year : new Date().getFullYear();
        // Request a 10-year schedule for preview
        const resp = await AutoDisbursementService.getRmd(newAutoDisbursement.source_asset_id, startYear, 10);
        if (Array.isArray(resp)) {
          setRmdSchedule(resp);
          setRecommendedRmd(resp[0] || null);
        } else {
          setRecommendedRmd(resp);
        }
        } catch (err) {
        setRmdError(formatError(err.response?.data?.detail || err.message || 'Failed to fetch RMD'));
      } finally {
        setRmdLoading(false);
      }
    };
    fetchRmd();
  }, [newAutoDisbursement.distribution_type, newAutoDisbursement.source_asset_id, userSettings]);

  const handleCreateAutoDisbursement = async () => {
    if (isViewingOther) {
      setMessage('Automatic transfers are read-only when viewing another account.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (!newAutoDisbursement.name || !newAutoDisbursement.source_asset_id || !newAutoDisbursement.target_asset_id) {
      setMessage('Error: Name, Source Asset, and Target Asset are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    // If taxable IRA distribution, enforce additional required fields
    if (newAutoDisbursement.distribution_type === 'taxable_ira') {
      if (!newAutoDisbursement.start_date) {
        setMessage('Error: start_date is required for taxable IRA distributions');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      // Ensure source asset belongs to a retirement account
      const sourceAsset = assets.find(a => a.id === parseInt(newAutoDisbursement.source_asset_id));
      const sourceAccount = accounts.find(acc => acc.id === (sourceAsset?.account_id || null));
      if (!sourceAccount || !sourceAccount.is_retirement) {
        setMessage('Error: Source must be a retirement account for taxable IRA distributions');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      const targetAsset = assets.find(a => a.id === parseInt(newAutoDisbursement.target_asset_id));
      const targetAccount = accounts.find(acc => acc.id === (targetAsset?.account_id || null));
      if (targetAccount && targetAccount.is_retirement) {
        setMessage('Error: Target must be a non-retirement account for taxable IRA distributions');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    }
    // If non-taxable, enforce source is non-retirement or Roth
    if (newAutoDisbursement.distribution_type === 'non_taxable') {
      const sourceAsset = assets.find(a => a.id === parseInt(newAutoDisbursement.source_asset_id));
      const sourceAccount = accounts.find(acc => acc.id === (sourceAsset?.account_id || null));
      const isRoth = sourceAsset && !!sourceAsset.is_roth;
      if (sourceAccount && sourceAccount.is_retirement && !isRoth) {
        setMessage('Error: Source must be a non-retirement account or a Roth account for Non-taxable Distributions');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
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
        use_rmd: !!newAutoDisbursement.use_rmd,
          rmd_overrides: newAutoDisbursement.rmd_overrides || null,
        start_date: newAutoDisbursement.start_date || null,
        end_date: newAutoDisbursement.end_date || null,
      });
      setMessage('Auto-disbursement created successfully!');
      setNewAutoDisbursement(() => ({
        name: '',
        source_asset_id: '',
        target_asset_id: '',
        distribution_type: 'non_taxable',
        transfer_type: 'percentage',
        transfer_value: '',
        start_date: '',
        end_date: '',
        use_rmd: false,
        rmd_overrides: {},
      }));
      loadData();
      setTimeout(() => {
        setMessage('');
        navigate('/app'); // Close the page after successful save
      }, 1000);
    } catch (e) {
      const errorMessage = formatError(e.response?.data?.detail || e.message || 'Error creating auto-disbursement');
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleUpdateAutoDisbursement = async (id, updatedAutoDisbursement) => {
    if (isViewingOther) {
      setMessage('Automatic transfers are read-only when viewing another account.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
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
        use_rmd: !!updatedAutoDisbursement.use_rmd,
        rmd_overrides: updatedAutoDisbursement.rmd_overrides || null,
        start_date: updatedAutoDisbursement.start_date || null,
        end_date: updatedAutoDisbursement.end_date || null,
      });
      setMessage('Auto-disbursement updated successfully!');
      setEditingAutoDisbursement(null);
      loadData();
      setTimeout(() => {
        setMessage('');
        navigate('/app'); // Close the page after successful save
      }, 1000);
    } catch (e) {
      const errorMessage = formatError(e.response?.data?.detail || e.message || 'Error updating auto-disbursement');
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteAutoDisbursement = async (id) => {
    if (isViewingOther) {
      setMessage('Automatic transfers are read-only when viewing another account.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
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
          const errorMessage = formatError(e.response?.data?.detail || e.message || 'Error deleting auto-disbursement');
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
    if (isViewingOther) {
      setMessage('Surplus asset is read-only when viewing another account.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setMessage('');
    try {
      await SettingsService.updateSettings({
        surplus_asset_id: surplusAssetId || null,
      });
      await refreshSettings();
      setMessage('Surplus Asset saved successfully!');
      setTimeout(() => {
        setMessage('');
        navigate('/app'); // Close the page after successful save
      }, 1000);
    } catch (e) {
      const errorMessage = formatError(e.response?.data?.detail || e.message || 'Error saving surplus asset');
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCancel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = '/';
  };

  if (loading) {
    return <div className="loading-message">Loading automatic transfers...</div>;
  }

  return (
    <ErrorBoundary>
    <div className="settings-page-container auto-disbursements-page">
      <h2>Automatic Transfers</h2>
      {isViewingOther && (
        <div className="message" style={{ backgroundColor: '#e2e3ff', color: '#1e1b4b', border: '1px solid #b3b7ff', marginBottom: '20px' }}>
          You are viewing another account. Automatic transfers are shown for reference only and cannot be modified.
        </div>
      )}
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
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={handleSaveSurplusAsset} className="btn-primary-modern" style={{ padding: '10px 24px', whiteSpace: 'nowrap' }}>
                Save
              </button>
              <button type="button" onClick={handleCancel} className="btn-primary-modern" style={{ backgroundColor: '#6c757d', padding: '10px 24px', whiteSpace: 'nowrap' }}>
                Cancel
              </button>
            </div>
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
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr)', gap: '20px', alignItems: 'start', marginBottom: '18px' }}>
              {/* Row 1: Name | Source Asset | Target Asset */}
              <div className="form-field">
                <label htmlFor="name">Name of Distribution *</label>
                <input
                  id="name"
                  ref={nameRef}
                  type="text"
                  placeholder="e.g. IRA to Savings"
                  value={newAutoDisbursement.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const pos = e.target.selectionStart;
                    setNewAutoDisbursement(prev => ({ ...prev, name: val }));
                    setTimeout(() => {
                      const el = nameRef.current;
                      if (el) {
                        el.focus();
                        try { el.setSelectionRange(pos, pos); } catch (err) {}
                      }
                    }, 0);
                  }}
                  className="input-modern"
                />
              </div>
              <div className="form-field">
                <label htmlFor="source_asset_id">Source Asset *</label>
                <select
                  id="source_asset_id"
                  value={newAutoDisbursement.source_asset_id || ''}
                  onChange={(e) => setNewAutoDisbursement(prev => ({ ...prev, source_asset_id: e.target.value || '' }))}
                  className="input-modern"
                >
                  <option value="">Select Source Asset</option>
                  {assets && assets.length > 0 ? (
                    assets
                      .filter(a => {
                        if (newAutoDisbursement.distribution_type === 'taxable_ira') {
                          // only retirement accounts as source
                          const acc = accounts.find(ac => ac.id === a.account_id);
                          return acc && acc.is_retirement;
                        }
                        return true;
                      })
                      .map((asset) => (
                        <option key={asset.id} value={String(asset.id)}>
                          {asset.name} ({asset.category}{asset.is_roth ? ' • Roth' : ''})
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
                  onChange={(e) => setNewAutoDisbursement(prev => ({ ...prev, target_asset_id: e.target.value || '' }))}
                  className="input-modern"
                >
                  <option value="">Select Target Asset</option>
                  {assets && assets.length > 0 ? (
                    assets
                      .filter(a => {
                        if (newAutoDisbursement.distribution_type === 'taxable_ira') {
                          // only non-retirement targets
                          const acc = accounts.find(ac => ac.id === a.account_id);
                          return !(acc && acc.is_retirement);
                        }
                        return true;
                      })
                      .map((asset) => (
                        <option key={asset.id} value={String(asset.id)}>
                          {asset.name} ({asset.category}{asset.is_roth ? ' • Roth' : ''})
                        </option>
                      ))
                  ) : (
                    <option value="" disabled>No assets available</option>
                  )}
                </select>
              </div>
              {/* Row 2: Distribution Type | Transfer Type | Transfer Value */}
              <div className="form-field">
                <label htmlFor="distribution_type">Distribution Type</label>
                <select
                  id="distribution_type"
                  value={newAutoDisbursement.distribution_type || 'non_taxable'}
                  onChange={(e) => setNewAutoDisbursement(prev => ({ ...prev, distribution_type: e.target.value || 'non_taxable' }))}
                  className="input-modern"
                >
                  <option value="non_taxable">Non-taxable Distribution</option>
                  <option value="taxable_ira">Taxable IRA Distribution</option>
                </select>
                {newAutoDisbursement.distribution_type === 'taxable_ira' && (
                  <>
                    <small style={{ display: 'block', color: '#666', marginTop: '6px' }}>
                      Taxable transfer from a non-Roth retirement account to a non-retirement account. Required: start date and owner birth date in profile.
                    </small>
                    <label style={{ display: 'block', marginTop: '8px' }}>
                      <input
                        type="checkbox"
                        checked={!!newAutoDisbursement.use_rmd}
                        onChange={(e) => setNewAutoDisbursement(prev => ({ ...prev, use_rmd: e.target.checked }))}
                        style={{ marginRight: 8 }}
                      />
                      Use RMD each year
                    </label>
                  </>
                )}
                {newAutoDisbursement.distribution_type === 'non_taxable' && (
                  <small style={{ display: 'block', color: '#666', marginTop: '6px' }}>
                    Non-taxable transfers should come from non-retirement accounts or Roth accounts. The source will be validated when saving.
                  </small>
                )}
              </div>
              <div className="form-field">
                <label htmlFor="transfer_type">Transfer Type *</label>
                <select
                  id="transfer_type"
                  value={newAutoDisbursement.transfer_type}
                  onChange={(e) => setNewAutoDisbursement(prev => ({ ...prev, transfer_type: e.target.value }))}
                  className="input-modern"
                >
                  <option value="percentage">Percentage</option>
                  <option value="dollar_amount">Dollar Amount</option>
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
                  ref={transferValueRef}
                  onChange={(e) => {
                    const val = e.target.value;
                    const pos = e.target.selectionStart;
                    setNewAutoDisbursement(prev => ({ ...prev, transfer_value: val }));
                    setTimeout(() => {
                      const el = transferValueRef.current;
                      if (el) {
                        el.focus();
                        try { el.setSelectionRange(pos, pos); } catch (err) {}
                      }
                    }, 0);
                  }}
                  className="input-modern"
                />
                {recommendedRmd && (
                  <div style={{ marginTop: '6px' }}>
                    <small style={{ color: '#007bff' }}>
                      {`Recommended RMD for year ${recommendedRmd.year}: ${(
                        (recommendedRmd.rmd_amount != null && !isNaN(Number(recommendedRmd.rmd_amount)))
                          ? `$${Number(recommendedRmd.rmd_amount).toFixed(2)}`
                          : '—'
                      )} (divisor ${recommendedRmd.divisor || '—'}, table ${typeof recommendedRmd.table_used === 'string' ? recommendedRmd.table_used : (recommendedRmd.table_used == null ? '—' : JSON.stringify(recommendedRmd.table_used))})`}
                    </small>
                    <div style={{ marginTop: '6px' }}>
                      <button
                        type="button"
                        className="btn-primary-modern"
                        onClick={() => {
                          if (recommendedRmd.rmd_amount != null) {
                            setNewAutoDisbursement(prev => ({ ...prev, transfer_type: 'dollar_amount', transfer_value: Number(recommendedRmd.rmd_amount).toFixed(2) }));
                          }
                        }}
                        style={{ padding: '6px 10px' }}
                      >
                        Use recommended RMD
                      </button>
                    </div>
                  </div>
                )}
                {rmdLoading && <div style={{ marginTop: '6px' }}><small>Calculating RMD...</small></div>}
                {rmdError && <div style={{ marginTop: '6px', color: '#c00' }}><small>{rmdError}</small></div>}
              </div>
              <div className="form-field">
                <label htmlFor="start_date">Start Date</label>
                <input
                  id="start_date"
                  type="date"
                  value={newAutoDisbursement.start_date}
                  ref={startDateRef}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewAutoDisbursement(prev => ({ ...prev, start_date: val }));
                    setTimeout(() => {
                      const el = startDateRef.current;
                      if (el) el.focus();
                    }, 0);
                  }}
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
                  ref={endDateRef}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewAutoDisbursement(prev => ({ ...prev, end_date: val }));
                    setTimeout(() => {
                      const el = endDateRef.current;
                      if (el) el.focus();
                    }, 0);
                  }}
                  className="input-modern"
                />
                <small style={{ color: '#666', fontSize: '0.8em', marginTop: '3px', display: 'block' }}>Optional</small>
              </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px', marginTop: '18px', marginBottom: '30px' }}>
            {!editingId ? (
              <button onClick={handleCreateAutoDisbursement} className="btn-primary-modern">
                Add Auto-Disbursement
              </button>
            ) : (
              <>
                <button onClick={() => {
                    handleUpdateAutoDisbursement(editingId, newAutoDisbursement);
                    setEditingId(null);
                  }} className="btn-primary-modern">
                  Update Auto-Disbursement
                </button>
                <button onClick={() => {
                    setEditingId(null);
                    setNewAutoDisbursement(() => ({
                      name: '',
                      source_asset_id: '',
                      target_asset_id: '',
                      distribution_type: 'non_taxable',
                      transfer_type: 'percentage',
                      transfer_value: '',
                      start_date: '',
                      end_date: '',
                      use_rmd: false,
                      rmd_overrides: {},
                    }));
                  }} className="cancel-button">
                  Cancel
                </button>
              </>
            )}
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
                          <button onClick={() => {
                              setNewAutoDisbursement(prev => ({
                                ...prev,
                                ...ad,
                                source_asset_id: ad.source_asset_id ? String(ad.source_asset_id) : '',
                                target_asset_id: ad.target_asset_id ? String(ad.target_asset_id) : '',
                                distribution_type: ad.distribution_type || 'non_taxable',
                                use_rmd: !!ad.use_rmd,
                                rmd_overrides: ad.rmd_overrides || {},
                              }));
                              setEditingId(ad.id);
                              setActiveTab('disbursements');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} className="edit-icon-btn" title="Edit">
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


      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, title: '' })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
    </ErrorBoundary>
  );
};

export default AutoDisbursementSettingsPage;


import React, { useState, useEffect } from 'react';
import AutoDisbursementService from '../../services/auto_disbursement.service';
import AssetService from '../../services/asset.service';
import SettingsService from '../../services/settings.service';
import { useSettingsContext } from '../../context/SettingsContext';
import './Wizard.css';

const AutomaticTransfersSetupWizard = ({ isOpen, onClose, onComplete }: any) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [surplusAssetId, setSurplusAssetId] = useState<any>(null);
  const [newTransfer, setNewTransfer] = useState<any>({
    name: '',
    source_asset_id: null,
    target_asset_id: null,
    transfer_type: 'percentage',
    transfer_value: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const { refreshSettings } = useSettingsContext();

  const loadData = async () => {
    try {
      const [assetsRes, transfersRes, settingsRes] = await Promise.all([
        AssetService.list(),
        AutoDisbursementService.getAllAutoDisbursements().catch((): any[] => []),
        SettingsService.getSettings(),
      ]);
      setAssets(assetsRes.data || []);
      setTransfers(transfersRes || []);
      setSurplusAssetId(settingsRes.data.surplus_asset_id || null);
    } catch (e: any) {
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      // After setting surplus asset, move to transfers
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // After adding at least one transfer or skipping, move to review
      setCurrentStep(3);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveSurplusAsset = async () => {
    setMessage('');
    setLoading(true);
    try {
      await SettingsService.updateSettings({
        surplus_asset_id: surplusAssetId || null,
      });
      await refreshSettings();
      setMessage('Surplus Asset saved!');
      setTimeout(() => setMessage(''), 2000);
    } catch (e: any) {
      setMessage(e.response?.data?.detail || 'Error saving surplus asset');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransfer = async () => {
    if (!newTransfer.name || !newTransfer.source_asset_id || !newTransfer.target_asset_id) {
      setMessage('Name, Source Asset, and Target Asset are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (newTransfer.source_asset_id === newTransfer.target_asset_id) {
      setMessage('Source and Target assets cannot be the same');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const transferValue = parseFloat(newTransfer.transfer_value);
    if (isNaN(transferValue) || transferValue <= 0) {
      setMessage('Transfer Value must be a positive number');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (newTransfer.transfer_type === 'percentage' && transferValue > 100) {
      setMessage('Percentage cannot exceed 100%');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    try {
      await AutoDisbursementService.createAutoDisbursement({
        ...newTransfer,
        source_asset_id: parseInt(newTransfer.source_asset_id),
        target_asset_id: parseInt(newTransfer.target_asset_id),
        transfer_value: transferValue,
        start_date: newTransfer.start_date || null,
        end_date: newTransfer.end_date || null,
      });
      setMessage('Transfer added successfully!');
      setNewTransfer({
        name: '',
        source_asset_id: null,
        target_asset_id: null,
        transfer_type: 'percentage',
        transfer_value: '',
        start_date: '',
        end_date: '',
      });
      await loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e: any) {
      setMessage(e.response?.data?.detail || 'Error creating transfer');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) onComplete();
    onClose();
  };

  if (!isOpen) return null;

  const totalSteps = 3;
  const stepTitles = [
    "Surplus Asset",
    "Automatic Transfers",
    "Review & Complete"
  ];

  const getAssetName = (assetId: any) => {
    const asset = assets.find((a: any) => a.id === assetId);
    return asset ? `${asset.name} (${asset.category})` : 'Unknown';
  };

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container" onClick={(e: any) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>Walk Me Through: Setup Automatic Transfers</h2>
          <button className="wizard-close" onClick={onClose}>×</button>
        </div>

        <div className="wizard-progress">
          <div className="wizard-steps">
            {Array.from({ length: totalSteps }, (_: any, i: any) => (
              <div key={i + 1} className={`wizard-step ${currentStep >= i + 1 ? 'active' : ''}`}>
                <div className="wizard-step-number">{i + 1}</div>
                <div className="wizard-step-title">{stepTitles[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="wizard-content">
          {message && <div className={`wizard-message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}

          {currentStep === 1 && (
            <div className="wizard-step-content">
              <h3>Step 1: Surplus Asset (Optional)</h3>
              <p className="wizard-hint">
                Designate an asset account where yearly cash flow surplus/deficit will be automatically added or subtracted.
              </p>
              {assets.length === 0 ? (
                <div className="wizard-warning">
                  <p>No assets found. Please add assets first before setting up automatic transfers.</p>
                </div>
              ) : (
                <div className="wizard-form">
                  <div className="form-group">
                    <label>Surplus Asset</label>
                    <select
                      value={surplusAssetId || ''}
                      onChange={(e: any) => setSurplusAssetId(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">None (No automatic surplus/deficit handling)</option>
                      {assets.map((asset: any) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name} ({asset.category})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button 
                    className="wizard-btn wizard-btn-primary" 
                    onClick={handleSaveSurplusAsset}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Surplus Asset'}
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="wizard-step-content">
              <h3>Step 2: Automatic Transfers</h3>
              <p className="wizard-hint">
                Set up automatic transfers between accounts (e.g., 10% of IRA to Savings each year).
              </p>
              {assets.length < 2 ? (
                <div className="wizard-warning">
                  <p>You need at least 2 assets to set up automatic transfers.</p>
                </div>
              ) : (
                <>
                  <div className="wizard-form">
                    <div className="form-group">
                      <label>Transfer Name *</label>
                      <input
                        type="text"
                        name="transfer-name"
                        autoComplete="off"
                        value={newTransfer.name}
                        onChange={(e: any) => setNewTransfer({ ...newTransfer, name: e.target.value })}
                        placeholder="e.g., IRA to Savings"
                      />
                    </div>
                    <div className="form-group">
                      <label>Transfer Type *</label>
                      <select
                        name="transfer-type"
                        autoComplete="off"
                        value={newTransfer.transfer_type}
                        onChange={(e: any) => setNewTransfer({ ...newTransfer, transfer_type: e.target.value })}
                      >
                        <option value="percentage">Percentage</option>
                        <option value="dollar_amount">Dollar Amount</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Source Asset *</label>
                      <select
                        name="source-asset-select"
                        autoComplete="off"
                        value={newTransfer.source_asset_id || ''}
                        onChange={(e: any) => setNewTransfer({ ...newTransfer, source_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                      >
                        <option value="">Select Source Asset</option>
                        {assets.map((asset: any) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.name} ({asset.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Target Asset *</label>
                      <select
                        name="target-asset-select"
                        autoComplete="off"
                        value={newTransfer.target_asset_id || ''}
                        onChange={(e: any) => setNewTransfer({ ...newTransfer, target_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                      >
                        <option value="">Select Target Asset</option>
                        {assets.map((asset: any) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.name} ({asset.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Transfer Value per year * ({newTransfer.transfer_type === 'percentage' ? '%' : '$'})</label>
                      <input
                        type="number"
                        name="transfer-value"
                        autoComplete="off"
                        step={newTransfer.transfer_type === 'percentage' ? '0.1' : '0.01'}
                        value={newTransfer.transfer_value}
                        onChange={(e: any) => setNewTransfer({ ...newTransfer, transfer_value: e.target.value })}
                        placeholder={newTransfer.transfer_type === 'percentage' ? 'e.g., 10' : 'e.g., 5000'}
                      />
                    </div>
                    <div className="form-group">
                      <label>Start Date (Optional)</label>
                      <input
                        type="date"
                        name="start-date"
                        autoComplete="off"
                        value={newTransfer.start_date}
                        onChange={(e: any) => setNewTransfer({ ...newTransfer, start_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date (Optional)</label>
                      <input
                        type="date"
                        name="end-date"
                        autoComplete="off"
                        value={newTransfer.end_date}
                        onChange={(e: any) => setNewTransfer({ ...newTransfer, end_date: e.target.value })}
                      />
                    </div>
                    <button 
                      className="wizard-btn wizard-btn-primary" 
                      onClick={handleAddTransfer}
                      disabled={loading || !newTransfer.name || !newTransfer.source_asset_id || !newTransfer.target_asset_id}
                    >
                      {loading ? 'Adding...' : 'Add Transfer'}
                    </button>
                  </div>

                  {transfers.length > 0 && (
                    <div className="wizard-transfers-list" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                      <h4>Your Transfers ({transfers.length})</h4>
                      <div className="accounts-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Source</th>
                              <th>Target</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transfers.map((t: any) => (
                              <tr key={t.id}>
                                <td>{t.name}</td>
                                <td>{getAssetName(t.source_asset_id)}</td>
                                <td>{getAssetName(t.target_asset_id)}</td>
                                <td>{t.transfer_type === 'percentage' ? `${t.transfer_value}%` : `$${t.transfer_value.toLocaleString()}`}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="wizard-step-content">
              <h3>Step 3: Review & Complete</h3>
              <div className="wizard-review">
                <div className="review-section">
                  <h4>Surplus Asset</h4>
                  {surplusAssetId ? (
                    <p>{getAssetName(surplusAssetId)}</p>
                  ) : (
                    <p className="no-categories">None selected</p>
                  )}
                </div>
                <div className="review-section">
                  <h4>Automatic Transfers ({transfers.length})</h4>
                  {transfers.length > 0 ? (
                    <div className="accounts-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Source</th>
                            <th>Target</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transfers.map((t: any) => (
                            <tr key={t.id}>
                              <td>{t.name}</td>
                              <td>{getAssetName(t.source_asset_id)}</td>
                              <td>{getAssetName(t.target_asset_id)}</td>
                              <td>{t.transfer_type === 'percentage' ? `${t.transfer_value}%` : `$${t.transfer_value.toLocaleString()}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-categories">No transfers set up</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="wizard-actions">
          <button className="wizard-btn wizard-btn-secondary" onClick={handleBack} disabled={currentStep === 1}>
            Back
          </button>
          <button 
            className="wizard-btn wizard-btn-primary" 
            onClick={handleNext}
            disabled={loading || (currentStep === 2 && assets.length < 2)}
          >
            {currentStep === totalSteps ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutomaticTransfersSetupWizard;


import React, { useState, useEffect } from 'react';
import AssetService from '../../services/asset.service';
import SettingsService from '../../services/settings.service';
import AccountService from '../../services/account.service';
import './Wizard.css';

const AssetsSetupWizard = ({ isOpen, onClose, onComplete }: any) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [newAsset, setNewAsset] = useState<any>({
    name: '',
    category: '',
    value: '',
    annual_increase_percent: '0',
    annual_change_type: 'increase',
    account_id: null,
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [settingsRes, accountsRes, assetsRes] = await Promise.all([
        SettingsService.getSettings(),
        AccountService.getAllAccounts().catch((): any[] => []),
        AssetService.list(),
      ]);
      setCategories(settingsRes.data.asset_categories || []);
      setAccounts(accountsRes || []);
      setAssets(assetsRes.data || []);
      if (categories.length > 0 && !newAsset.category) {
        setNewAsset((prev: any) => ({ ...prev, category: categories[0] }));
      }
    } catch (e: any) {
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      // After adding first asset, move to review
      if (assets.length > 0) {
        setCurrentStep(2);
      } else {
        setMessage('Please add at least one asset to continue.');
        setTimeout(() => setMessage(''), 3000);
      }
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddAsset = async () => {
    if (!newAsset.name || !newAsset.category || !newAsset.value) {
      setMessage('Name, Category, and Value are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    try {
      await AssetService.create({
        name: newAsset.name,
        category: newAsset.category,
        value: parseFloat(newAsset.value),
        annual_increase_percent: parseFloat(newAsset.annual_increase_percent || '0'),
        annual_change_type: newAsset.annual_change_type,
        account_id: newAsset.account_id || null,
        start_date: newAsset.start_date || null,
        end_date: newAsset.end_date || null,
      });
      setMessage('Asset added successfully!');
      setNewAsset({
        name: '',
        category: categories[0] || '',
        value: '',
        annual_increase_percent: '0',
        annual_change_type: 'increase',
        account_id: null,
        start_date: '',
        end_date: '',
      });
      await loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e: any) {
      setMessage(e.response?.data?.detail || 'Error creating asset');
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

  const totalSteps = 2;
  const stepTitles = [
    "Add Assets",
    "Review & Complete"
  ];

  const formatCurrency = (v: any) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container" onClick={(e: any) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>Walk Me Through: Setup Assets</h2>
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
              <h3>Step 1: Add Assets</h3>
              <p className="wizard-hint">
                Add your assets (e.g., checking accounts, savings, investments, real estate).
              </p>
              {categories.length === 0 ? (
                <div className="wizard-warning">
                  <p>No asset categories found. Please set up categories first from Settings &gt; Categories.</p>
                </div>
              ) : (
                <>
                  <div className="wizard-form">
                    <div className="form-group">
                      <label>Asset Name *</label>
                      <input
                        type="text"
                        name="asset-name"
                        autoComplete="off"
                        value={newAsset.name}
                        onChange={(e: any) => setNewAsset({ ...newAsset, name: e.target.value })}
                        placeholder="e.g., My Checking Account"
                      />
                    </div>
                    <div className="form-group">
                      <label>Category *</label>
                      <select
                        name="asset-category"
                        autoComplete="off"
                        value={newAsset.category}
                        onChange={(e: any) => setNewAsset({ ...newAsset, category: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {[...categories].sort().map((cat: any) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Account (Optional)</label>
                      <select
                        value={newAsset.account_id || ''}
                        onChange={(e: any) => setNewAsset({ ...newAsset, account_id: e.target.value ? parseInt(e.target.value) : null })}
                      >
                        <option value="">None</option>
                        {accounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.brokerage} - {acc.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Current Value *</label>
                      <input
                        type="number"
                        name="asset-value"
                        autoComplete="off"
                        step="0.01"
                        value={newAsset.value}
                        onChange={(e: any) => setNewAsset({ ...newAsset, value: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-group">
                      <label>Annual Change Type</label>
                      <select
                        name="asset-annual-change-type"
                        autoComplete="off"
                        value={newAsset.annual_change_type}
                        onChange={(e: any) => setNewAsset({ ...newAsset, annual_change_type: e.target.value })}
                      >
                        <option value="increase">Increase</option>
                        <option value="decrease">Decrease</option>
                        <option value="fixed">Fixed (No Change)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Annual Rate (%)</label>
                      <input
                        type="number"
                        name="asset-annual-increase-percent"
                        autoComplete="off"
                        step="0.1"
                        value={newAsset.annual_increase_percent}
                        onChange={(e: any) => setNewAsset({ ...newAsset, annual_increase_percent: e.target.value })}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Start Date (Optional)</label>
                      <input
                        type="date"
                        name="asset-start-date"
                        autoComplete="off"
                        value={newAsset.start_date}
                        onChange={(e: any) => setNewAsset({ ...newAsset, start_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date (Optional)</label>
                      <input
                        type="date"
                        name="asset-end-date"
                        autoComplete="off"
                        value={newAsset.end_date}
                        onChange={(e: any) => setNewAsset({ ...newAsset, end_date: e.target.value })}
                      />
                    </div>
                    <button 
                      className="wizard-btn wizard-btn-primary" 
                      onClick={handleAddAsset}
                      disabled={loading || !newAsset.name || !newAsset.category || !newAsset.value}
                    >
                      {loading ? 'Adding...' : 'Add Asset'}
                    </button>
                  </div>

                  {assets.length > 0 && (
                    <div className="wizard-assets-list" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                      <h4>Your Assets ({assets.length})</h4>
                      <div className="accounts-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Category</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assets.map((asset: any) => (
                              <tr key={asset.id}>
                                <td>{asset.name}</td>
                                <td>{asset.category}</td>
                                <td>{formatCurrency(asset.value)}</td>
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

          {currentStep === 2 && (
            <div className="wizard-step-content">
              <h3>Step 2: Review & Complete</h3>
              <div className="wizard-review">
                <div className="review-section">
                  <h4>Your Assets ({assets.length})</h4>
                  {assets.length > 0 ? (
                    <div className="accounts-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Value</th>
                            <th>Annual Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assets.map((asset: any) => (
                            <tr key={asset.id}>
                              <td>{asset.name}</td>
                              <td>{asset.category}</td>
                              <td>{formatCurrency(asset.value)}</td>
                              <td>{asset.annual_increase_percent}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-categories">No assets added yet.</p>
                  )}
                </div>
                <p className="wizard-hint">
                  You can add more assets later from the Assets section in the navigation.
                </p>
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
            disabled={loading || (currentStep === 1 && assets.length === 0)}
          >
            {currentStep === totalSteps ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetsSetupWizard;


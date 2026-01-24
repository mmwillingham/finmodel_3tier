import React, { useState, useEffect } from 'react';
import CashFlowService from '../../services/cashflow.service';
import SettingsService from '../../services/settings.service';
import AssetService from '../../services/asset.service';
import LiabilityService from '../../services/liability.service';
import './Wizard.css';

const IncomeSetupWizard = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState([]);
  const [personOptions, setPersonOptions] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);
  const [isDynamic, setIsDynamic] = useState(false);
  const [linkedItemType, setLinkedItemType] = useState('');
  const [linkedItemId, setLinkedItemId] = useState(null);
  const [percentage, setPercentage] = useState('');
  const [availableLinkedItems, setAvailableLinkedItems] = useState({
    assets: [],
    liabilities: [],
    income: [],
    expenses: [],
  });
  const [newIncome, setNewIncome] = useState({
    category: '',
    description: '',
    value: '',
    frequency: 'yearly',
    annual_increase_percent: 0,
    person: '',
    start_date: '',
    end_date: '',
    taxable: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const fetchLinkedItems = async () => {
        try {
          const [assetsRes, liabilitiesRes, incomeRes, expensesRes] = await Promise.all([
            AssetService.list(),
            LiabilityService.list(),
            CashFlowService.list(true),
            CashFlowService.list(false),
          ]);
          setAvailableLinkedItems({
            assets: assetsRes.data,
            liabilities: liabilitiesRes.data,
            income: incomeRes.data,
            expenses: expensesRes.data,
          });
        } catch (error) {
        }
      };
      fetchLinkedItems();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [settingsRes, incomeRes] = await Promise.all([
        SettingsService.getSettings(),
        CashFlowService.list(true),
      ]);
      setCategories(settingsRes.data.income_categories || []);
      setIncomeItems(incomeRes.data || []);
      
      const persons = [
        settingsRes.data.person1_first_name && settingsRes.data.person1_first_name !== 'Person 1' ? settingsRes.data.person1_first_name : null,
        settingsRes.data.person2_first_name && settingsRes.data.person2_first_name !== 'Person 2' ? settingsRes.data.person2_first_name : null,
      ].filter(Boolean);

      let newPersonOptions = ['Select Person'];
      if (persons.length > 0) {
        newPersonOptions.push('Family', ...persons);
      }
      setPersonOptions(newPersonOptions);
    } catch (e) {
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (incomeItems.length > 0) {
        setCurrentStep(2);
      } else {
        setMessage('Please add at least one income item to continue.');
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

  const getLinkedItemOptions = () => {
    const typeToKeyMap = {
      'asset': 'assets',
      'liability': 'liabilities',
      'income': 'income',
      'expense': 'expenses'
    };
    const key = typeToKeyMap[linkedItemType.toLowerCase()];
    const items = availableLinkedItems[key] || [];
    return items.map(item => ({
      id: item.id,
      name: item.name || item.description,
      category: item.category,
    }));
  };

  const handleAddIncome = async () => {
    if (!newIncome.category || !newIncome.description) {
      setMessage('Category and Description are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (isDynamic) {
      if (!linkedItemType || !linkedItemId || percentage === '' || isNaN(parseFloat(percentage))) {
        setMessage('Please select a linked item type, an item, and enter a valid percentage.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    } else {
      if (!newIncome.value || isNaN(parseFloat(newIncome.value))) {
        setMessage('Please enter a valid value.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        is_income: true,
        category: newIncome.category,
        description: newIncome.description,
        frequency: newIncome.frequency || 'yearly',
        value: isDynamic ? 0.0 : parseFloat(newIncome.value),
        annual_increase_percent: parseFloat(newIncome.annual_increase_percent || 0),
        person: newIncome.person === 'Select Person' || newIncome.person === 'Family' ? null : newIncome.person || null,
        start_date: newIncome.start_date || null,
        end_date: newIncome.end_date || null,
        taxable: newIncome.taxable,
        linked_item_id: isDynamic ? linkedItemId : null,
        linked_item_type: isDynamic ? linkedItemType : null,
        percentage: isDynamic ? parseFloat(percentage) : null,
      };

      await CashFlowService.create(payload);
      setMessage('Income item added successfully!');
      setNewIncome({
        category: '',
        description: '',
        value: '',
        frequency: 'yearly',
        annual_increase_percent: 0,
        person: '',
        start_date: '',
        end_date: '',
        taxable: true,
      });
      setIsDynamic(false);
      setLinkedItemType('');
      setLinkedItemId(null);
      setPercentage('');
      await loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Error creating income item');
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
    "Add Income Items",
    "Review & Complete"
  ];

  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>Walk Me Through: Setup Income</h2>
          <button className="wizard-close" onClick={onClose}>×</button>
        </div>

        <div className="wizard-progress">
          <div className="wizard-steps">
            {Array.from({ length: totalSteps }, (_, i) => (
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
              <h3>Step 1: Add Income Items</h3>
              <p className="wizard-hint">
                Add your income sources (e.g., salary, rental income, investment income). You can set fixed amounts or link to other items as a percentage.
              </p>
              {categories.length === 0 ? (
                <div className="wizard-warning">
                  <p>No income categories found. Please set up categories first from Settings &gt; Categories.</p>
                </div>
              ) : (
                <>
                  <div className="wizard-form">
                    <div className="form-group">
                      <label>Category *</label>
                      <select
                        value={newIncome.category}
                        onChange={(e) => setNewIncome({ ...newIncome, category: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {[...categories].sort().map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Description *</label>
                      <input
                        type="text"
                        value={newIncome.description}
                        onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                        placeholder="e.g., Salary, Rental Income"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={isDynamic}
                          onChange={(e) => setIsDynamic(e.target.checked)}
                        />
                        Link to another item (percentage-based)
                      </label>
                    </div>
                    {isDynamic ? (
                      <>
                        <div className="form-group">
                          <label>Linked Item Type *</label>
                          <select
                            value={linkedItemType}
                            onChange={(e) => {
                              setLinkedItemType(e.target.value);
                              setLinkedItemId(null);
                            }}
                          >
                            <option value="">Select Type</option>
                            <option value="asset">Asset</option>
                            <option value="liability">Liability</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                          </select>
                        </div>
                        {linkedItemType && (
                          <div className="form-group">
                            <label>Linked Item *</label>
                            <select
                              value={linkedItemId || ''}
                              onChange={(e) => setLinkedItemId(e.target.value ? parseInt(e.target.value) : null)}
                            >
                              <option value="">Select Item</option>
                              {getLinkedItemOptions().map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.category})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="form-group">
                          <label>Percentage (%) *</label>
                          <input
                            type="number"
                            step="0.1"
                            value={percentage}
                            onChange={(e) => setPercentage(e.target.value)}
                            placeholder="e.g., 10"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-group">
                          <label>Value *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newIncome.value}
                            onChange={(e) => setNewIncome({ ...newIncome, value: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="form-group">
                          <label>Frequency</label>
                          <select
                            value={newIncome.frequency}
                            onChange={(e) => setNewIncome({ ...newIncome, frequency: e.target.value })}
                          >
                            <option value="yearly">Yearly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Annual Increase (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={newIncome.annual_increase_percent}
                            onChange={(e) => setNewIncome({ ...newIncome, annual_increase_percent: e.target.value })}
                            placeholder="0.0"
                          />
                        </div>
                      </>
                    )}
                    <div className="form-group">
                      <label>Person</label>
                      <select
                        value={newIncome.person}
                        onChange={(e) => setNewIncome({ ...newIncome, person: e.target.value })}
                      >
                        {personOptions.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={newIncome.taxable}
                          onChange={(e) => setNewIncome({ ...newIncome, taxable: e.target.checked })}
                        />
                        Taxable
                      </label>
                    </div>
                    <div className="form-group">
                      <label>Start Date (Optional)</label>
                      <input
                        type="date"
                        value={newIncome.start_date}
                        onChange={(e) => setNewIncome({ ...newIncome, start_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date (Optional)</label>
                      <input
                        type="date"
                        value={newIncome.end_date}
                        onChange={(e) => setNewIncome({ ...newIncome, end_date: e.target.value })}
                      />
                    </div>
                    <button 
                      className="wizard-btn wizard-btn-primary" 
                      onClick={handleAddIncome}
                      disabled={loading || !newIncome.category || !newIncome.description}
                    >
                      {loading ? 'Adding...' : 'Add Income Item'}
                    </button>
                  </div>

                  {incomeItems.length > 0 && (
                    <div className="wizard-income-list" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                      <h4>Your Income Items ({incomeItems.length})</h4>
                      <div className="accounts-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Category</th>
                              <th>Yearly Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incomeItems.map((item) => (
                              <tr key={item.id}>
                                <td>{item.description}</td>
                                <td>{item.category}</td>
                                <td>{formatCurrency(item.yearly_value)}</td>
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
                  <h4>Your Income Items ({incomeItems.length})</h4>
                  {incomeItems.length > 0 ? (
                    <div className="accounts-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Yearly Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incomeItems.map((item) => (
                            <tr key={item.id}>
                              <td>{item.description}</td>
                              <td>{item.category}</td>
                              <td>{formatCurrency(item.yearly_value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-categories">No income items added yet.</p>
                  )}
                </div>
                <p className="wizard-hint">
                  You can add more income items later from the Income section in the navigation.
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
            disabled={loading || (currentStep === 1 && incomeItems.length === 0)}
          >
            {currentStep === totalSteps ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomeSetupWizard;


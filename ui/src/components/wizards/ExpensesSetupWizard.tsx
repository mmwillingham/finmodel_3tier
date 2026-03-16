import React, { useState, useEffect } from 'react';
import CashFlowService from '../../services/cashflow.service';
import SettingsService from '../../services/settings.service';
import AssetService from '../../services/asset.service';
import LiabilityService from '../../services/liability.service';
import './Wizard.css';

const ExpensesSetupWizard = ({ isOpen, onClose, onComplete }: any) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [personOptions, setPersonOptions] = useState<any[]>([]);
  const [expenseItems, setExpenseItems] = useState<any[]>([]);
  const [defaultInflation, setDefaultInflation] = useState(2.0);
  const [isDynamic, setIsDynamic] = useState(false);
  const [linkedItemType, setLinkedItemType] = useState('');
  const [linkedItemId, setLinkedItemId] = useState<any>(null);
  const [percentage, setPercentage] = useState('');
  const [availableLinkedItems, setAvailableLinkedItems] = useState<any>({
    assets: [],
    liabilities: [],
    income: [],
    expenses: [],
  });
  const [newExpense, setNewExpense] = useState<any>({
    category: '',
    description: '',
    value: '',
    frequency: 'yearly',
    inflation_percent: '2.0',
    person: '',
    start_date: '',
    end_date: '',
    tax_deductible: false,
    contributes_to_asset_id: null,
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
        } catch (error: any) {
        }
      };
      fetchLinkedItems();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [settingsRes, expenseRes] = await Promise.all([
        SettingsService.getSettings(),
        CashFlowService.list(false),
      ]);
      setCategories(settingsRes.data.expense_categories || []);
      setExpenseItems(expenseRes.data || []);
      setDefaultInflation(settingsRes.data.default_inflation_percent || 2.0);
      setNewExpense((prev: any) => ({ ...prev, inflation_percent: String(settingsRes.data.default_inflation_percent || 2.0) }));
      
      const persons = [
        settingsRes.data.person1_first_name && settingsRes.data.person1_first_name !== 'Person 1' ? settingsRes.data.person1_first_name : null,
        settingsRes.data.person2_first_name && settingsRes.data.person2_first_name !== 'Person 2' ? settingsRes.data.person2_first_name : null,
      ].filter(Boolean);

      let newPersonOptions = ['Select Person'];
      if (persons.length > 0) {
        newPersonOptions.push('Family', ...persons);
      }
      setPersonOptions(newPersonOptions);
    } catch (e: any) {
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (expenseItems.length > 0) {
        setCurrentStep(2);
      } else {
        setMessage('Please add at least one expense item to continue.');
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
    const key = (typeToKeyMap as any)[linkedItemType.toLowerCase()];
    const items = (availableLinkedItems as any)[key] || [];
    return items.map((item: any) => ({
      id: item.id,
      name: item.name || item.description,
      category: item.category,
    }));
  };

  const handleAddExpense = async () => {
    if (!newExpense.category || !newExpense.description) {
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
      if (!newExpense.value || isNaN(parseFloat(newExpense.value))) {
        setMessage('Please enter a valid value.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        is_income: false,
        category: newExpense.category,
        description: newExpense.description,
        frequency: newExpense.frequency || 'yearly',
        value: isDynamic ? 0.0 : parseFloat(newExpense.value),
        inflation_percent: parseFloat(newExpense.inflation_percent || String(defaultInflation)),
        person: newExpense.person === 'Select Person' || newExpense.person === 'Family' ? null : newExpense.person || null,
        start_date: newExpense.start_date || null,
        end_date: newExpense.end_date || null,
        tax_deductible: newExpense.tax_deductible,
        linked_item_id: isDynamic ? linkedItemId : null,
        linked_item_type: isDynamic ? linkedItemType : null,
        percentage: isDynamic ? parseFloat(percentage) : null,
        contributes_to_asset_id: newExpense.contributes_to_asset_id || null,
      };

      await CashFlowService.create(payload);
      setMessage('Expense item added successfully!');
      setNewExpense({
        category: '',
        description: '',
        value: '',
        frequency: 'yearly',
        inflation_percent: String(defaultInflation),
        person: '',
        start_date: '',
        end_date: '',
        tax_deductible: false,
        contributes_to_asset_id: null,
      });
      setIsDynamic(false);
      setLinkedItemType('');
      setLinkedItemId(null);
      setPercentage('');
      await loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e: any) {
      setMessage(e.response?.data?.detail || 'Error creating expense item');
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
    "Add Expense Items",
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
          <h2>Walk Me Through: Setup Expenses</h2>
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
              <h3>Step 1: Add Expense Items</h3>
              <p className="wizard-hint">
                Add your expenses (e.g., housing, food, transportation). You can set fixed amounts, link to other items as a percentage, or have expenses contribute to an asset.
              </p>
              {categories.length === 0 ? (
                <div className="wizard-warning">
                  <p>No expense categories found. Please set up categories first from Settings &gt; Categories.</p>
                </div>
              ) : (
                <>
                  <div className="wizard-form">
                    <div className="form-group">
                      <label>Category *</label>
                      <select
                        value={newExpense.category}
                        onChange={(e: any) => setNewExpense({ ...newExpense, category: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {[...categories].sort().map((cat: any) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Description *</label>
                      <input
                        type="text"
                        name="expense-description"
                        autoComplete="off"
                        value={newExpense.description}
                        onChange={(e: any) => setNewExpense({ ...newExpense, description: e.target.value })}
                        placeholder="e.g., Rent, Groceries"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          name="expense-is-dynamic"
                          autoComplete="off"
                          checked={isDynamic}
                          onChange={(e: any) => setIsDynamic(e.target.checked)}
                        />
                        Link to another item (percentage-based)
                      </label>
                    </div>
                    {isDynamic ? (
                      <>
                        <div className="form-group">
                          <label>Linked Item Type *</label>
                          <select
                            name="linked-item-type"
                            autoComplete="off"
                            value={linkedItemType}
                            onChange={(e: any) => {
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
                              name="linked-item-id"
                              autoComplete="off"
                              value={linkedItemId || ''}
                              onChange={(e: any) => setLinkedItemId(e.target.value ? parseInt(e.target.value) : null)}
                            >
                              <option value="">Select Item</option>
                              {getLinkedItemOptions().map((item: any) => (
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
                            name="percentage"
                            autoComplete="off"
                            value={percentage}
                            onChange={(e: any) => setPercentage(e.target.value)}
                            placeholder="e.g., 20"
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
                            name="expense-value"
                            autoComplete="off"
                            value={newExpense.value}
                            onChange={(e: any) => setNewExpense({ ...newExpense, value: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="form-group">
                          <label>Frequency</label>
                          <select
                            name="expense-frequency"
                            autoComplete="off"
                            value={newExpense.frequency}
                            onChange={(e: any) => setNewExpense({ ...newExpense, frequency: e.target.value })}
                          >
                            <option value="yearly">Yearly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Inflation Rate (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            name="expense-inflation-percent"
                            autoComplete="off"
                            value={newExpense.inflation_percent}
                            onChange={(e: any) => setNewExpense({ ...newExpense, inflation_percent: e.target.value })}
                            placeholder={defaultInflation.toString()}
                          />
                        </div>
                      </>
                    )}
                    <div className="form-group">
                      <label>Contributes to Asset (Optional)</label>
                      <select
                        name="expense-contributes-to-asset-id"
                        autoComplete="off"
                        value={newExpense.contributes_to_asset_id || ''}
                        onChange={(e: any) => setNewExpense({ ...newExpense, contributes_to_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                      >
                        <option value="">None</option>
                        {availableLinkedItems.assets.map((asset: any) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.name} ({asset.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Person</label>
                      <select
                        name="expense-person"
                        autoComplete="off"
                        value={newExpense.person}
                        onChange={(e: any) => setNewExpense({ ...newExpense, person: e.target.value })}
                      >
                        {personOptions.map((p: any) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          name="expense-tax-deductible"
                          autoComplete="off"
                          checked={newExpense.tax_deductible}
                          onChange={(e: any) => setNewExpense({ ...newExpense, tax_deductible: e.target.checked })}
                        />
                        Tax Deductible
                      </label>
                    </div>
                    <div className="form-group">
                      <label>Start Date (Optional)</label>
                      <input
                        type="date"
                        name="expense-start-date"
                        autoComplete="off"
                        value={newExpense.start_date}
                        onChange={(e: any) => setNewExpense({ ...newExpense, start_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date (Optional)</label>
                      <input
                        type="date"
                        name="expense-end-date"
                        autoComplete="off"
                        value={newExpense.end_date}
                        onChange={(e: any) => setNewExpense({ ...newExpense, end_date: e.target.value })}
                      />
                    </div>
                    <button 
                      className="wizard-btn wizard-btn-primary" 
                      onClick={handleAddExpense}
                      disabled={loading || !newExpense.category || !newExpense.description}
                    >
                      {loading ? 'Adding...' : 'Add Expense Item'}
                    </button>
                  </div>

                  {expenseItems.length > 0 && (
                    <div className="wizard-expenses-list" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                      <h4>Your Expense Items ({expenseItems.length})</h4>
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
                            {expenseItems.map((item: any) => (
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
                  <h4>Your Expense Items ({expenseItems.length})</h4>
                  {expenseItems.length > 0 ? (
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
                          {expenseItems.map((item: any) => (
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
                    <p className="no-categories">No expense items added yet.</p>
                  )}
                </div>
                <p className="wizard-hint">
                  You can add more expense items later from the Expenses section in the navigation.
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
            disabled={loading || (currentStep === 1 && expenseItems.length === 0)}
          >
            {currentStep === totalSteps ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpensesSetupWizard;


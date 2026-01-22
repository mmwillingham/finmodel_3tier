import React, { useState, useEffect } from 'react';
import LiabilityService from '../../services/liability.service';
import SettingsService from '../../services/settings.service';
import './Wizard.css';

const calculateAmortizedMonthlyPayment = (principal, annualInterestRatePercent, loanTermMonths) => {
  if (principal <= 0 || annualInterestRatePercent < 0 || loanTermMonths <= 0) {
    return 0;
  }
  const monthlyInterestRate = (annualInterestRatePercent / 100) / 12;
  if (monthlyInterestRate === 0) {
    return principal / loanTermMonths;
  }
  return (principal * monthlyInterestRate) / (1 - Math.pow(1 + monthlyInterestRate, -loanTermMonths));
};

const LiabilitiesSetupWizard = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [newLiability, setNewLiability] = useState({
    name: '',
    category: '',
    value: '',
    annual_increase_percent: 0,
    annual_change_type: 'increase',
    loan_type: 'ordinary',
    principal_amount: '',
    interest_rate: '',
    loan_term_months: '',
    loan_start_date: '',
    monthly_payment: '',
    start_date: '',
    end_date: '',
    decrease_by_principal_yearly: false,
    create_payment_expense: false,
    expense_category: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (newLiability.loan_type === 'amortized') {
      const principal = parseFloat(newLiability.principal_amount);
      const interestRate = parseFloat(newLiability.interest_rate);
      const loanTerm = parseInt(newLiability.loan_term_months, 10);

      if (!isNaN(principal) && !isNaN(interestRate) && !isNaN(loanTerm) && loanTerm > 0) {
        const calculatedPayment = calculateAmortizedMonthlyPayment(principal, interestRate, loanTerm);
        setNewLiability(prev => ({ ...prev, monthly_payment: calculatedPayment.toFixed(2) }));
      } else {
        setNewLiability(prev => ({ ...prev, monthly_payment: '' }));
      }
    }
  }, [newLiability.principal_amount, newLiability.interest_rate, newLiability.loan_term_months, newLiability.loan_type]);

  const loadData = async () => {
    try {
      const [settingsRes, liabilitiesRes] = await Promise.all([
        SettingsService.getSettings(),
        LiabilityService.list(),
      ]);
      const cats = settingsRes.data.liability_categories || ['Other'];
      setCategories(cats);
      setExpenseCategories(settingsRes.data.expense_categories || []);
      setLiabilities(liabilitiesRes.data || []);
      if (cats.length > 0 && !newLiability.category) {
        setNewLiability(prev => ({ ...prev, category: cats[0] }));
      }
    } catch (e) {
      console.error('Failed to load data', e);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (liabilities.length > 0) {
        setCurrentStep(2);
      } else {
        setMessage('Please add at least one liability to continue.');
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

  const handleAddLiability = async () => {
    if (!newLiability.name || !newLiability.category) {
      setMessage('Name and Category are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (newLiability.loan_type === 'amortized') {
      if (!newLiability.principal_amount || !newLiability.interest_rate || !newLiability.loan_term_months) {
        setMessage('Principal Amount, Interest Rate, and Loan Term are required for amortized loans');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      if (newLiability.create_payment_expense && !newLiability.expense_category) {
        setMessage('Expense Category is required when creating a payment expense');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    } else {
      if (!newLiability.value) {
        setMessage('Current Balance is required for ordinary/revolving liabilities');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: newLiability.name,
        category: newLiability.category,
        annual_change_type: 'increase',
        loan_type: newLiability.loan_type,
      };

      if (newLiability.loan_type === 'amortized') {
        payload.principal_amount = parseFloat(newLiability.principal_amount);
        payload.interest_rate = parseFloat(newLiability.interest_rate);
        payload.loan_term_months = parseInt(newLiability.loan_term_months, 10);
        payload.loan_start_date = newLiability.loan_start_date || null;
        payload.monthly_payment = parseFloat(newLiability.monthly_payment || 0);
        payload.decrease_by_principal_yearly = newLiability.decrease_by_principal_yearly;
        payload.create_payment_expense = newLiability.create_payment_expense;
        payload.expense_category = newLiability.create_payment_expense ? newLiability.expense_category : null;
        payload.value = payload.principal_amount; // For display purposes
      } else {
        payload.value = parseFloat(newLiability.value);
        payload.annual_increase_percent = parseFloat(newLiability.annual_increase_percent || 0);
      }

      payload.start_date = newLiability.start_date || null;
      payload.end_date = newLiability.end_date || null;

      await LiabilityService.create(payload);
      setMessage('Liability added successfully!');
      setNewLiability({
        name: '',
        category: categories[0] || '',
        value: '',
        annual_increase_percent: 0,
        annual_change_type: 'increase',
        loan_type: 'ordinary',
        principal_amount: '',
        interest_rate: '',
        loan_term_months: '',
        loan_start_date: '',
        monthly_payment: '',
        start_date: '',
        end_date: '',
        decrease_by_principal_yearly: false,
        create_payment_expense: false,
        expense_category: '',
      });
      await loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Error creating liability');
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
    "Add Liabilities",
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
          <h2>Walk Me Through: Setup Liabilities</h2>
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
              <h3>Step 1: Add Liabilities</h3>
              <p className="wizard-hint">
                Add your liabilities (e.g., mortgages, loans, credit cards). You can choose between ordinary/revolving or amortized loans.
              </p>
              {categories.length === 0 ? (
                <div className="wizard-warning">
                  <p>No liability categories found. Please set up categories first from Settings &gt; Categories.</p>
                </div>
              ) : (
                <>
                  <div className="wizard-form">
                    <div className="form-group">
                      <label>Liability Name *</label>
                      <input
                        type="text"
                        value={newLiability.name}
                        onChange={(e) => setNewLiability({ ...newLiability, name: e.target.value })}
                        placeholder="e.g., Mortgage, Credit Card"
                      />
                    </div>
                    <div className="form-group">
                      <label>Category *</label>
                      <select
                        value={newLiability.category}
                        onChange={(e) => setNewLiability({ ...newLiability, category: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {[...categories].sort().map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Loan Type *</label>
                      <select
                        value={newLiability.loan_type}
                        onChange={(e) => setNewLiability({ ...newLiability, loan_type: e.target.value })}
                      >
                        <option value="ordinary">Ordinary/Revolving</option>
                        <option value="amortized">Amortized Loan</option>
                      </select>
                    </div>

                    {newLiability.loan_type === 'amortized' ? (
                      <>
                        <div className="form-group">
                          <label>Principal Amount *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newLiability.principal_amount}
                            onChange={(e) => setNewLiability({ ...newLiability, principal_amount: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="form-group">
                          <label>Interest Rate (%) *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newLiability.interest_rate}
                            onChange={(e) => setNewLiability({ ...newLiability, interest_rate: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="form-group">
                          <label>Loan Term (Months) *</label>
                          <input
                            type="number"
                            value={newLiability.loan_term_months}
                            onChange={(e) => setNewLiability({ ...newLiability, loan_term_months: e.target.value })}
                            placeholder="e.g., 360"
                          />
                        </div>
                        {newLiability.monthly_payment && (
                          <div className="form-group">
                            <label>Calculated Monthly Payment</label>
                            <input
                              type="text"
                              value={formatCurrency(parseFloat(newLiability.monthly_payment))}
                              disabled
                              style={{ backgroundColor: '#f8f9fa' }}
                            />
                          </div>
                        )}
                        <div className="form-group">
                          <label>Loan Start Date</label>
                          <input
                            type="date"
                            value={newLiability.loan_start_date}
                            onChange={(e) => setNewLiability({ ...newLiability, loan_start_date: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={newLiability.decrease_by_principal_yearly}
                              onChange={(e) => setNewLiability({ ...newLiability, decrease_by_principal_yearly: e.target.checked })}
                            />
                            Decrease by principal amount yearly
                          </label>
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={newLiability.create_payment_expense}
                              onChange={(e) => setNewLiability({ ...newLiability, create_payment_expense: e.target.checked })}
                            />
                            Create corresponding expense for payment amount
                          </label>
                        </div>
                        {newLiability.create_payment_expense && (
                          <div className="form-group">
                            <label>Expense Category *</label>
                            <select
                              value={newLiability.expense_category}
                              onChange={(e) => setNewLiability({ ...newLiability, expense_category: e.target.value })}
                            >
                              <option value="">Select Category</option>
                              {[...expenseCategories].sort().map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="form-group">
                          <label>Current Balance *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newLiability.value}
                            onChange={(e) => setNewLiability({ ...newLiability, value: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="form-group">
                          <label>Annual Rate (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={newLiability.annual_increase_percent}
                            onChange={(e) => setNewLiability({ ...newLiability, annual_increase_percent: e.target.value })}
                            placeholder="0.0"
                          />
                        </div>
                      </>
                    )}

                    <div className="form-group">
                      <label>Start Date (Optional)</label>
                      <input
                        type="date"
                        value={newLiability.start_date}
                        onChange={(e) => setNewLiability({ ...newLiability, start_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date (Optional)</label>
                      <input
                        type="date"
                        value={newLiability.end_date}
                        onChange={(e) => setNewLiability({ ...newLiability, end_date: e.target.value })}
                      />
                    </div>
                    <button 
                      className="wizard-btn wizard-btn-primary" 
                      onClick={handleAddLiability}
                      disabled={loading || !newLiability.name || !newLiability.category}
                    >
                      {loading ? 'Adding...' : 'Add Liability'}
                    </button>
                  </div>

                  {liabilities.length > 0 && (
                    <div className="wizard-liabilities-list" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                      <h4>Your Liabilities ({liabilities.length})</h4>
                      <div className="accounts-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Type</th>
                              <th>Category</th>
                              <th>Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {liabilities.map((liab) => (
                              <tr key={liab.id}>
                                <td>{liab.name}</td>
                                <td>{liab.loan_type === 'amortized' ? 'Amortized' : 'Ordinary'}</td>
                                <td>{liab.category}</td>
                                <td>
                                  {liab.loan_type === 'amortized' 
                                    ? formatCurrency(liab.principal_amount) 
                                    : formatCurrency(liab.value)}
                                </td>
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
                  <h4>Your Liabilities ({liabilities.length})</h4>
                  {liabilities.length > 0 ? (
                    <div className="accounts-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Category</th>
                            <th>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liabilities.map((liab) => (
                            <tr key={liab.id}>
                              <td>{liab.name}</td>
                              <td>{liab.loan_type === 'amortized' ? 'Amortized' : 'Ordinary'}</td>
                              <td>{liab.category}</td>
                              <td>
                                {liab.loan_type === 'amortized' 
                                  ? formatCurrency(liab.principal_amount) 
                                  : formatCurrency(liab.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-categories">No liabilities added yet.</p>
                  )}
                </div>
                <p className="wizard-hint">
                  You can add more liabilities later from the Liabilities section in the navigation.
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
            disabled={loading || (currentStep === 1 && liabilities.length === 0)}
          >
            {currentStep === totalSteps ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiabilitiesSetupWizard;


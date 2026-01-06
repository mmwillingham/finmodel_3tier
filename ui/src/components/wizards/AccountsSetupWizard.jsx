import React, { useState, useEffect } from 'react';
import AccountService from '../../services/account.service';
import './Wizard.css';

const AccountsSetupWizard = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [newAccount, setNewAccount] = useState({
    broker: '',
    account_name: '',
    account_number: '',
    is_retirement: false,
  });

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const accountsData = await AccountService.getAllAccounts();
      setAccounts(accountsData);
    } catch (e) {
      console.error('Failed to load accounts', e);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      // After adding first account, move to review
      if (accounts.length > 0) {
        setCurrentStep(2);
      } else {
        setMessage('Please add at least one account to continue.');
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

  const handleAddAccount = async () => {
    if (!newAccount.broker || !newAccount.account_name) {
      setMessage('Broker and Account Name are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    try {
      await AccountService.createAccount(newAccount);
      setMessage('Account added successfully!');
      setNewAccount({ broker: '', account_name: '', account_number: '', is_retirement: false });
      await loadAccounts();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to create account', e);
      setMessage(e.response?.data?.detail || 'Error creating account');
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
    "Add Accounts",
    "Review & Complete"
  ];

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>Walk Me Through: Setup Accounts</h2>
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
              <h3>Step 1: Add Accounts</h3>
              <p className="wizard-hint">
                Accounts represent your financial institutions (e.g., banks, brokerages). 
                You can link assets to these accounts later.
              </p>
              
              <div className="wizard-form">
                <div className="form-group">
                  <label>Broker/Institution *</label>
                  <input
                    type="text"
                    value={newAccount.broker}
                    onChange={(e) => setNewAccount({ ...newAccount, broker: e.target.value })}
                    placeholder="e.g., Chase, Fidelity, Merrill Lynch"
                  />
                </div>
                <div className="form-group">
                  <label>Account Name *</label>
                  <input
                    type="text"
                    value={newAccount.account_name}
                    onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                    placeholder="e.g., Checking Account, Investment Account"
                  />
                </div>
                <div className="form-group">
                  <label>Account Number (Optional)</label>
                  <input
                    type="text"
                    value={newAccount.account_number}
                    onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                    placeholder="Last 4 digits or full number"
                  />
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newAccount.is_retirement}
                      onChange={(e) => setNewAccount({ ...newAccount, is_retirement: e.target.checked })}
                    />
                    Retirement Account (IRA, 401k, etc.)
                  </label>
                </div>
                <button 
                  className="wizard-btn wizard-btn-primary" 
                  onClick={handleAddAccount}
                  disabled={loading || !newAccount.broker || !newAccount.account_name}
                >
                  {loading ? 'Adding...' : 'Add Account'}
                </button>
              </div>

              {accounts.length > 0 && (
                <div className="wizard-accounts-list">
                  <h4>Your Accounts ({accounts.length})</h4>
                  <div className="accounts-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Broker</th>
                          <th>Account Name</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((acc) => (
                          <tr key={acc.id}>
                            <td>{acc.broker}</td>
                            <td>{acc.account_name}</td>
                            <td>{acc.is_retirement ? 'Retirement' : 'Regular'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="wizard-step-content">
              <h3>Step 2: Review & Complete</h3>
              <div className="wizard-review">
                <div className="review-section">
                  <h4>Your Accounts ({accounts.length})</h4>
                  {accounts.length > 0 ? (
                    <div className="accounts-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Broker</th>
                            <th>Account Name</th>
                            <th>Account Number</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((acc) => (
                            <tr key={acc.id}>
                              <td>{acc.broker}</td>
                              <td>{acc.account_name}</td>
                              <td>{acc.account_number || '-'}</td>
                              <td>{acc.is_retirement ? 'Retirement' : 'Regular'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-categories">No accounts added yet.</p>
                  )}
                </div>
                <p className="wizard-hint">
                  You can add more accounts later from Settings &gt; Accounts.
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
            disabled={loading || (currentStep === 1 && accounts.length === 0)}
          >
            {currentStep === totalSteps ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountsSetupWizard;


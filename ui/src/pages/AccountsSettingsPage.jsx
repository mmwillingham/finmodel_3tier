import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountService from '../services/account.service';
import { useAuth } from '../context/AuthContext';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages

const AccountsSettingsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [editingAccount, setEditingAccount] = useState(null);
  const [newAccount, setNewAccount] = useState({
    broker: '',
    account_name: '',
    account_number: '',
    is_retirement: false,
  });

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accountsData = await AccountService.getAllAccounts();
      setAccounts(accountsData);
    } catch (e) {
      console.error('Failed to load accounts', e);
      setError('Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleCreateAccount = async () => {
    if (!newAccount.broker || !newAccount.account_name) {
      setMessage('Broker and Account Name are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      await AccountService.createAccount(newAccount);
      setMessage('Account created successfully!');
      setNewAccount({ broker: '', account_name: '', account_number: '', is_retirement: false });
      loadAccounts();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to create account', e);
      const errorMessage = e.response?.data?.detail || 'Error creating account';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleUpdateAccount = async (accountId, updatedAccount) => {
    // Validate required fields
    if (!updatedAccount.broker || !updatedAccount.account_name) {
      setMessage('Error: Broker and Account Name are required fields.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      await AccountService.updateAccount(accountId, updatedAccount);
      setMessage('Account updated successfully!');
      setEditingAccount(null);
      loadAccounts();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to update account', e);
      const errorMessage = e.response?.data?.detail || 'Error updating account';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Are you sure you want to delete this account? Assets linked to this account will have their account link removed.')) {
      return;
    }

    try {
      await AccountService.deleteAccount(accountId);
      setMessage('Account deleted successfully!');
      loadAccounts();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to delete account', e);
      const errorMessage = e.response?.data?.detail || 'Error deleting account';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return <div className="loading-message">Loading accounts...</div>;
  }

  return (
    <div className="settings-page-container" style={{ maxWidth: '1200px' }}>
      <h2>Accounts</h2>
      {message && <div className={`message ${message.includes('Error') ? 'error' : ''}`}>{message}</div>}

      <div className="setting-group" style={{ maxWidth: '100%', width: '100%' }}>
        <h3>Add New Account</h3>
        <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px', width: '100%' }}>
          <div className="form-field">
            <label htmlFor="broker">Broker *</label>
            <input
              id="broker"
              type="text"
              placeholder="e.g., Merrill Lynch"
              value={newAccount.broker}
              onChange={(e) => setNewAccount({ ...newAccount, broker: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="account_name">Account Name *</label>
            <input
              id="account_name"
              type="text"
              placeholder="e.g., Investment Account"
              value={newAccount.account_name}
              onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="account_number">Account Number</label>
            <input
              id="account_number"
              type="text"
              placeholder="Optional"
              value={newAccount.account_number}
              onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="is_retirement">Retirement</label>
            <select
              id="is_retirement"
              value={newAccount.is_retirement ? 'yes' : 'no'}
              onChange={(e) => setNewAccount({ ...newAccount, is_retirement: e.target.value === 'yes' })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
        <button onClick={handleCreateAccount} className="save-button" style={{ marginBottom: '30px' }}>Add Account</button>
      </div>

      <div className="setting-group">
        <h3>Existing Accounts</h3>
        {accounts.length === 0 ? (
          <p>No accounts defined. Add an account above.</p>
        ) : (
          <table className="accounts-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
            <thead>
              <tr>
                <th>Broker</th>
                <th>Account Name</th>
                <th>Account Number</th>
                <th>Retirement</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  {editingAccount?.id === account.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editingAccount.broker}
                          onChange={(e) => setEditingAccount({ ...editingAccount, broker: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editingAccount.account_name}
                          onChange={(e) => setEditingAccount({ ...editingAccount, account_name: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editingAccount.account_number || ''}
                          onChange={(e) => setEditingAccount({ ...editingAccount, account_number: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <select
                          value={editingAccount.is_retirement ? 'yes' : 'no'}
                          onChange={(e) => setEditingAccount({ ...editingAccount, is_retirement: e.target.value === 'yes' })}
                          style={{ width: '100%', padding: '5px' }}
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </td>
                      <td>
                        <button onClick={() => handleUpdateAccount(account.id, editingAccount)} className="save-button" style={{ padding: '5px 10px', marginRight: '5px' }}>Save</button>
                        <button onClick={() => setEditingAccount(null)} className="cancel-button" style={{ padding: '5px 10px' }}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{account.broker}</td>
                      <td>{account.account_name}</td>
                      <td>{account.account_number || '-'}</td>
                      <td>{account.is_retirement ? 'Yes' : 'No'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button onClick={() => setEditingAccount({ ...account })} className="edit-icon-btn" title="Edit">
                            <span role="img" aria-label="edit">✏️</span>
                          </button>
                          <button onClick={() => handleDeleteAccount(account.id)} className="delete-icon-btn" title="Delete">
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
        )}
      </div>

      <div className="settings-page-actions">
        <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
      </div>
    </div>
  );
};

export default AccountsSettingsPage;


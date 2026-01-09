import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountService from '../services/account.service';
import BrokerageService from '../services/brokerage.service';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import './SettingsPages.css'; // General CSS for settings pages

const AccountsSettingsPage = () => {
  const { currentUser, viewingUserId } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [accounts, setAccounts] = useState([]);
  const [brokerages, setBrokerages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [editingAccount, setEditingAccount] = useState(null);
  const [showNewBrokerageForm, setShowNewBrokerageForm] = useState(false);
  const [newBrokerage, setNewBrokerage] = useState({
    name: '',
    broker_name: '',
    broker_phone: '',
    broker_email: '',
  });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [newAccount, setNewAccount] = useState({
    brokerage_id: null,
    brokerage: '', // Legacy field - used when creating new brokerage
    broker_name: '',
    broker_phone: '',
    broker_email: '',
    account_name: '',
    account_number: '',
    is_retirement: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountsData, brokeragesData] = await Promise.all([
        AccountService.getAllAccounts(viewingUserId || null),
        BrokerageService.getAllBrokerages(viewingUserId || null).catch(() => []) // Brokerages may not exist yet
      ]);
      setAccounts(accountsData || []);
      setBrokerages(brokeragesData || []);
    } catch (e) {
      console.error('Failed to load data', e);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [viewingUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBrokerage = async () => {
    if (!newBrokerage.name) {
      setMessage('Brokerage name is required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      await BrokerageService.createBrokerage(newBrokerage);
      setMessage('Brokerage created successfully!');
      setNewBrokerage({ name: '', broker_name: '', broker_phone: '', broker_email: '' });
      setShowNewBrokerageForm(false);
      loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to create brokerage', e);
      const errorMessage = e.response?.data?.detail || 'Error creating brokerage';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCreateAccount = async () => {
    if ((!newAccount.brokerage_id && !newAccount.brokerage) || !newAccount.account_name) {
      setMessage('Brokerage and Account Name are required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      // If brokerage_id is selected, use it; otherwise use legacy fields to create/find brokerage
      const accountData = newAccount.brokerage_id 
        ? { brokerage_id: newAccount.brokerage_id, account_name: newAccount.account_name, account_number: newAccount.account_number, is_retirement: newAccount.is_retirement }
        : newAccount;
      
      await AccountService.createAccount(accountData);
      setMessage('Account created successfully!');
      setNewAccount({ brokerage_id: null, brokerage: '', broker_name: '', broker_phone: '', broker_email: '', account_name: '', account_number: '', is_retirement: false });
      loadData();
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
    if (!updatedAccount.account_name) {
      setMessage('Error: Account Name is required.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      // Only send updatable fields (brokerage_id, account_name, account_number, is_retirement)
      const updateData = {
        brokerage_id: updatedAccount.brokerage_id,
        account_name: updatedAccount.account_name,
        account_number: updatedAccount.account_number,
        is_retirement: updatedAccount.is_retirement,
      };
      await AccountService.updateAccount(accountId, updateData);
      setMessage('Account updated successfully!');
      setEditingAccount(null);
      loadData();
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to update account', e);
      const errorMessage = e.response?.data?.detail || 'Error updating account';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Account',
      message: 'Are you sure you want to delete this account? Assets linked to this account will have their account link removed.',
      onConfirm: async () => {
        try {
          await AccountService.deleteAccount(accountId);
          setMessage('Account deleted successfully!');
          loadData();
          setTimeout(() => setMessage(''), 2000);
        } catch (e) {
          console.error('Failed to delete account', e);
          const errorMessage = e.response?.data?.detail || 'Error deleting account';
          setMessage(errorMessage);
          setTimeout(() => setMessage(''), 3000);
        }
      }
    });
  };

  // Group accounts by brokerage
  const accountsByBrokerage = accounts.reduce((acc, account) => {
    const key = account.brokerage || 'Unknown';
    if (!acc[key]) {
      acc[key] = {
        brokerage: account.brokerage,
        broker_name: account.broker_name,
        broker_phone: account.broker_phone,
        broker_email: account.broker_email,
        accounts: []
      };
    }
    acc[key].accounts.push(account);
    return acc;
  }, {});

  if (loading) {
    return <div className="loading-message">Loading accounts...</div>;
  }

  return (
    <div className="settings-page-container" style={{ maxWidth: '1100px' }}>
      <h2>Accounts</h2>
      {message && (
        <div 
          className={`message ${message.includes('Error') ? 'error' : 'success'}`}
          style={{ 
            padding: '10px 15px', 
            borderRadius: '6px', 
            marginBottom: '15px',
            backgroundColor: message.includes('Error') ? '#fee' : '#efe',
            color: message.includes('Error') ? '#c00' : '#060'
          }}
        >
          {message}
        </div>
      )}

      {/* Brokerage Management Section */}
      <div className="setting-group card-modern" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Brokerages</h3>
          <button 
            onClick={() => setShowNewBrokerageForm(!showNewBrokerageForm)} 
            className="btn-secondary-modern"
            style={{ padding: '6px 12px', fontSize: '0.9em' }}
          >
            {showNewBrokerageForm ? 'Cancel' : '+ New Brokerage'}
          </button>
        </div>
        {showNewBrokerageForm && (
          <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', marginBottom: '12px' }}>
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
              <div className="form-field">
                <label htmlFor="brokerage_name">Brokerage Name *</label>
                <input
                  id="brokerage_name"
                  type="text"
                  placeholder="e.g., Merrill Lynch"
                  value={newBrokerage.name}
                  onChange={(e) => setNewBrokerage({ ...newBrokerage, name: e.target.value })}
                  className="input-modern"
                />
              </div>
              <div className="form-field">
                <label htmlFor="broker_name_new">Broker Name</label>
                <input
                  id="broker_name_new"
                  type="text"
                  placeholder="Optional"
                  value={newBrokerage.broker_name}
                  onChange={(e) => setNewBrokerage({ ...newBrokerage, broker_name: e.target.value })}
                  className="input-modern"
                />
              </div>
              <div className="form-field">
                <label htmlFor="broker_phone_new">Broker Phone</label>
                <input
                  id="broker_phone_new"
                  type="text"
                  placeholder="Optional"
                  value={newBrokerage.broker_phone}
                  onChange={(e) => setNewBrokerage({ ...newBrokerage, broker_phone: e.target.value })}
                  className="input-modern"
                />
              </div>
              <div className="form-field">
                <label htmlFor="broker_email_new">Broker Email</label>
                <input
                  id="broker_email_new"
                  type="email"
                  placeholder="Optional"
                  value={newBrokerage.broker_email}
                  onChange={(e) => setNewBrokerage({ ...newBrokerage, broker_email: e.target.value })}
                  className="input-modern"
                />
              </div>
            </div>
            <button onClick={handleCreateBrokerage} className="btn-primary-modern" style={{ padding: '8px 16px', fontSize: '0.9em' }}>Create Brokerage</button>
          </div>
        )}
        {brokerages.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {brokerages.map(b => (
              <span 
                key={b.id} 
                className="badge-modern"
                style={{ 
                  padding: '6px 12px', 
                  backgroundColor: '#e0edfb', 
                  borderRadius: '6px', 
                  fontSize: '0.85em',
                  fontWeight: 500
                }}
              >
                {b.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="setting-group card-modern" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Add New Account</h3>
        <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
          <div className="form-field">
            <label htmlFor="brokerage_select">Brokerage *</label>
            <select
              id="brokerage_select"
              value={newAccount.brokerage_id || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'new') {
                  setNewAccount({ ...newAccount, brokerage_id: null, brokerage: '' });
                  setShowNewBrokerageForm(true);
                } else if (val) {
                  setNewAccount({ ...newAccount, brokerage_id: parseInt(val), brokerage: '' });
                } else {
                  setNewAccount({ ...newAccount, brokerage_id: null });
                }
              }}
              className="input-modern"
            >
              <option value="">Select Brokerage...</option>
              {brokerages.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value="new">+ Create New Brokerage</option>
            </select>
            {!newAccount.brokerage_id && brokerages.length === 0 && (
              <input
                type="text"
                placeholder="Enter new brokerage name"
                value={newAccount.brokerage}
                onChange={(e) => setNewAccount({ ...newAccount, brokerage: e.target.value, brokerage_id: null })}
                className="input-modern"
                style={{ marginTop: '8px' }}
              />
            )}
          </div>
          <div className="form-field">
            <label htmlFor="account_name">Account Name *</label>
            <input
              id="account_name"
              type="text"
              placeholder="e.g., Investment Account"
              value={newAccount.account_name}
              onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
              className="input-modern"
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
              className="input-modern"
            />
          </div>
          <div className="form-field">
            <label htmlFor="is_retirement">Retirement</label>
            <select
              id="is_retirement"
              value={newAccount.is_retirement ? 'yes' : 'no'}
              onChange={(e) => setNewAccount({ ...newAccount, is_retirement: e.target.value === 'yes' })}
              className="input-modern"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
        <button onClick={handleCreateAccount} className="btn-primary-modern" style={{ padding: '8px 16px', fontSize: '0.9em' }}>Add Account</button>
      </div>

      <div className="setting-group">
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Existing Accounts</h3>
        {accounts.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No accounts defined. Add an account above.</p>
        ) : (
          <div>
            {Object.entries(accountsByBrokerage).map(([brokerageName, group]) => (
              <div key={brokerageName} className="card-modern" style={{ marginBottom: '20px', padding: '15px' }}>
                <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e0edfb' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600 }}>
                    {brokerageName}
                    {group.broker_name && <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '8px', fontWeight: 'normal' }}>— {group.broker_name}</span>}
                  </h4>
                  {(group.broker_phone || group.broker_email) && (
                    <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                      {group.broker_phone && <span>📞 {group.broker_phone}</span>}
                      {group.broker_phone && group.broker_email && <span style={{ marginLeft: '10px' }}>|</span>}
                      {group.broker_email && <span style={{ marginLeft: '10px' }}>📧 {group.broker_email}</span>}
                    </div>
                  )}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="accounts-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '80px' }}>Owner</th>
                        <th style={{ minWidth: '120px' }}>Account Name</th>
                        <th style={{ minWidth: '120px' }}>Account Number</th>
                        <th style={{ minWidth: '100px' }}>Retirement</th>
                        <th style={{ minWidth: '100px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.accounts.map((account) => (
                        <tr key={account.id}>
                          {editingAccount?.id === account.id ? (
                            <>
                              <td>
                                {account.owner_id === currentUser?.id ? (
                                  <span style={{ color: '#28a745', fontWeight: 'bold' }}>Me</span>
                                ) : (
                                  <span style={{ color: '#6c757d' }}>{account.owner_email ? account.owner_email.split('@')[0] : 'Other User'}</span>
                                )}
                              </td>
                              <td>
                                <select
                                  value={editingAccount.brokerage_id || ''}
                                  onChange={(e) => setEditingAccount({ ...editingAccount, brokerage_id: e.target.value ? parseInt(e.target.value) : null })}
                                  className="input-modern"
                                  style={{ width: '100%', fontSize: '0.9em', padding: '6px' }}
                                >
                                  <option value="">Select Brokerage...</option>
                                  {brokerages.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={editingAccount.account_name}
                                  onChange={(e) => setEditingAccount({ ...editingAccount, account_name: e.target.value })}
                                  className="input-modern"
                                  style={{ width: '100%', fontSize: '0.9em', padding: '6px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={editingAccount.account_number || ''}
                                  onChange={(e) => setEditingAccount({ ...editingAccount, account_number: e.target.value })}
                                  className="input-modern"
                                  style={{ width: '100%', fontSize: '0.9em', padding: '6px' }}
                                />
                              </td>
                              <td>
                                <select
                                  value={editingAccount.is_retirement ? 'yes' : 'no'}
                                  onChange={(e) => setEditingAccount({ ...editingAccount, is_retirement: e.target.value === 'yes' })}
                                  className="input-modern"
                                  style={{ width: '100%', fontSize: '0.9em', padding: '6px' }}
                                >
                                  <option value="no">No</option>
                                  <option value="yes">Yes</option>
                                </select>
                              </td>
                              <td>
                                <button 
                                  onClick={() => handleUpdateAccount(account.id, editingAccount)} 
                                  className="btn-primary-modern" 
                                  style={{ padding: '4px 8px', marginRight: '4px', fontSize: '0.85em' }}
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={() => setEditingAccount(null)} 
                                  className="btn-secondary-modern" 
                                  style={{ padding: '4px 8px', fontSize: '0.85em' }}
                                >
                                  Cancel
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>
                                {account.owner_id === currentUser?.id ? (
                                  <span style={{ color: '#28a745', fontWeight: 'bold' }}>Me</span>
                                ) : (
                                  <span style={{ color: '#6c757d' }} title={account.owner_email || 'Authorized Access'}>
                                    {account.owner_email ? account.owner_email.split('@')[0] : 'Other User'}
                                  </span>
                                )}
                              </td>
                              <td style={{ fontWeight: 500 }}>{account.account_name}</td>
                              <td>{account.account_number || '-'}</td>
                              <td>{account.is_retirement ? 'Yes' : 'No'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {account.owner_id === currentUser?.id ? (
                                    <>
                                      <button 
                                        onClick={() => setEditingAccount({ ...account, brokerage_id: account.brokerage_id || null })} 
                                        className="edit-icon-btn" 
                                        title="Edit"
                                        style={{ padding: '4px 6px', fontSize: '1em' }}
                                      >
                                        ✏️
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteAccount(account.id)} 
                                        className="delete-icon-btn" 
                                        title="Delete"
                                        style={{ padding: '4px 6px', fontSize: '1em' }}
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  ) : (
                                    <span style={{ color: '#6c757d', fontSize: '0.85em' }} title="You can only edit your own accounts">View Only</span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
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

export default AccountsSettingsPage;


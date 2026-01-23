import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountService from '../services/account.service';
import BrokerageService from '../services/brokerage.service';
import PlaidService from '../services/plaid.service';
import PlaidLinkButton from '../components/PlaidLinkButton';
import PlaidConnections from '../components/PlaidConnections';
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
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, onRetain: null, title: '' });
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
  const [renamingBrokerageId, setRenamingBrokerageId] = useState(null);
  const [renamingBrokerageName, setRenamingBrokerageName] = useState('');

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

  const handleDeleteAccount = async (accountId, accountName) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Account',
      message: `Are you sure you want to delete the account "${accountName}"?\n\nThis will:\n• Remove the account link from all assets and liabilities\n• OR delete all assets and liabilities linked to this account (if you choose cascade delete)`,
      onConfirm: async (cascadeDelete) => {
        try {
          await AccountService.deleteAccount(accountId, cascadeDelete || false);
          setMessage(cascadeDelete 
            ? 'Account and linked items deleted successfully!' 
            : 'Account deleted successfully! Linked assets/liabilities had their account link removed.');
          loadData();
          setTimeout(() => setMessage(''), 3000);
          setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onRetain: null, title: '' });
        } catch (e) {
          console.error('Failed to delete account', e);
          const errorMessage = e.response?.data?.detail || 'Error deleting account';
          setMessage(errorMessage);
          setTimeout(() => setMessage(''), 3000);
        }
      },
      showCascadeOption: true,
      cascadeMessage: 'Also delete all assets and liabilities linked to this account',
      showCancel: true,
      cancelText: 'Cancel'
    });
  };

  const handleDeleteBrokerage = async (brokerageId, brokerageName) => {
    try {
      // Check if brokerage is in use
      const usage = await BrokerageService.checkBrokerageUsage(brokerageId);
      
      if (usage.in_use) {
        const accountList = usage.account_names.length > 0 
          ? `\n\nLinked accounts:\n${usage.account_names.map(name => `  • ${name}`).join('\n')}`
          : '';
        setConfirmDialog({
          isOpen: true,
          title: 'Delete Brokerage with Linked Accounts?',
          message: `The brokerage "${brokerageName}" is linked to ${usage.account_count} account(s).${accountList}\n\nChoose an option:\n• Delete: Delete the brokerage, all linked accounts, and all assets/liabilities linked to those accounts\n• Retain: Delete the brokerage but keep all accounts, assets, and liabilities (they will no longer be linked to a brokerage)\n• Cancel: Do not delete anything`,
          onConfirm: async () => {
            try {
              await BrokerageService.deleteBrokerage(brokerageId, true, false); // cascade=true
              setMessage('Brokerage and linked accounts deleted successfully!');
              loadData();
              setTimeout(() => setMessage(''), 3000);
              setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onRetain: null, title: '' });
            } catch (e) {
              console.error('Failed to delete brokerage', e);
              const errorMessage = e.response?.data?.detail || 'Error deleting brokerage';
              setMessage(errorMessage);
              setTimeout(() => setMessage(''), 3000);
            }
          },
          onRetain: async () => {
            try {
              await BrokerageService.deleteBrokerage(brokerageId, false, true); // retain=true
              setMessage('Brokerage deleted successfully! Accounts, assets, and liabilities retained (no longer linked to a brokerage).');
              loadData();
              setTimeout(() => setMessage(''), 3000);
              setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onRetain: null, title: '' });
            } catch (e) {
              console.error('Failed to delete brokerage', e);
              const errorMessage = e.response?.data?.detail || 'Error deleting brokerage';
              setMessage(errorMessage);
              setTimeout(() => setMessage(''), 3000);
            }
          },
          showCancel: true,
          cancelText: 'Cancel',
          showRetain: true,
          confirmText: 'Delete',
          retainText: 'Retain',
          showCascadeOption: false
        });
        return;
      }

      // Brokerage is not in use, proceed with deletion
      setConfirmDialog({
        isOpen: true,
        title: 'Delete Brokerage',
        message: `Are you sure you want to delete the brokerage "${brokerageName}"?`,
        onConfirm: async () => {
          try {
            await BrokerageService.deleteBrokerage(brokerageId, false); // cascade=false
            setMessage('Brokerage deleted successfully!');
            loadData();
            setTimeout(() => setMessage(''), 2000);
            setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onRetain: null, title: '' });
          } catch (e) {
            console.error('Failed to delete brokerage', e);
            const errorMessage = e.response?.data?.detail || 'Error deleting brokerage';
            setMessage(errorMessage);
            setTimeout(() => setMessage(''), 3000);
          }
        },
        showCancel: true,
        cancelText: 'Cancel',
        showCascadeOption: false
      });
    } catch (e) {
      console.error('Failed to check brokerage usage', e);
      const errorMessage = e.response?.data?.detail || 'Error checking brokerage usage';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleStartRename = (brokerage) => {
    setRenamingBrokerageId(brokerage.id);
    setRenamingBrokerageName(brokerage.name);
  };

  const handleCancelRename = () => {
    setRenamingBrokerageId(null);
    setRenamingBrokerageName('');
  };

  const handleConfirmRename = async () => {
    if (!renamingBrokerageName.trim()) {
      setMessage('Brokerage name is required');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      await BrokerageService.updateBrokerage(renamingBrokerageId, { name: renamingBrokerageName.trim() });
      setMessage('Brokerage renamed successfully!');
      setTimeout(() => setMessage(''), 2000);
      handleCancelRename();
      loadData();
    } catch (e) {
      console.error('Failed to rename brokerage', e);
      const errorMessage = e.response?.data?.detail || 'Error renaming brokerage';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return <div className="loading-message">Loading accounts...</div>;
  }

  return (
    <div className="settings-page-container" style={{ maxWidth: '1600px' }}>
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

      {/* Plaid Bank Connection Section */}
      <div className="setting-group card-modern" style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: 0, marginBottom: '12px', fontWeight: 'bold', fontSize: '1.2em' }}>Connect Bank Accounts (Plaid)</h3>
        <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '12px' }}>
          Securely connect your bank accounts to automatically sync account balances as assets.
        </p>
        <PlaidLinkButton
          onSuccess={(syncData) => {
            setMessage(`Successfully connected ${syncData.accounts_synced} account(s). ${syncData.assets_created_or_updated} asset(s) created or updated.`);
            setTimeout(() => setMessage(''), 5000);
            // Optionally refresh accounts if needed
            loadData();
          }}
          onError={(err) => {
            const errorMsg = err.response?.data?.detail || 'Failed to connect account.';
            setMessage(`Error: ${errorMsg}`);
            setTimeout(() => setMessage(''), 5000);
          }}
        />
        <PlaidConnections
          onSyncSuccess={(syncData) => {
            setMessage(`Successfully synced ${syncData.accounts_synced} account(s). ${syncData.assets_created_or_updated} asset(s) updated.`);
            setTimeout(() => setMessage(''), 5000);
            loadData();
          }}
        />
      </div>

      {/* Brokerage Management Section */}
      <div className="setting-group card-modern" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Brokerages</h3>
          <button 
            onClick={() => setShowNewBrokerageForm(!showNewBrokerageForm)} 
            className="btn-primary-modern"
            style={{ padding: '10px 20px', fontSize: '0.95em', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
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
            <button onClick={handleCreateBrokerage} className="btn-primary-modern" style={{ padding: '10px 20px', fontSize: '0.95em', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Create Brokerage</button>
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
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {b.name}
                {b.owner_id === currentUser?.id && (
                  <button
                    onClick={() => handleDeleteBrokerage(b.id, b.name)}
                    className="delete-icon-btn"
                    title="Delete Brokerage"
                    style={{ 
                      padding: '2px 4px', 
                      fontSize: '0.9em',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#dc3545',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    🗑️
                  </button>
                )}
                {b.owner_id === currentUser?.id && (
                  <button
                    onClick={() => handleStartRename(b)}
                    className="delete-icon-btn"
                    title="Rename Brokerage"
                    style={{
                      padding: '2px 4px',
                      fontSize: '0.9em',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#007bff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ✏️
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {renamingBrokerageId && (
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff7e6', borderRadius: '6px', border: '1px solid #ffe0b2', maxWidth: '420px' }}>
            <div style={{ marginBottom: '8px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Rename Brokerage</span>
              <button
                onClick={handleCancelRename}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9em', color: '#333' }}
              >
                Cancel
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={renamingBrokerageName}
                onChange={(e) => setRenamingBrokerageName(e.target.value)}
                className="input-modern"
                style={{ flex: 1 }}
              />
              <button
                onClick={handleConfirmRename}
                className="btn-primary-modern"
                style={{ padding: '6px 16px', fontSize: '0.9em', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontWeight: 'bold', fontSize: '1.2em' }}>Add New Account</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-field">
            <label htmlFor="brokerage_select" style={{ marginBottom: '8px', display: 'block' }}>Brokerage *</label>
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
            <label htmlFor="account_name" style={{ marginBottom: '8px', display: 'block' }}>Account Name *</label>
            <input
              id="account_name"
              type="text"
              placeholder="e.g., Investment Account or Master CMA - Savings"
              value={newAccount.account_name}
              onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
              className="input-modern"
            />
          </div>
          <div className="form-field">
            <label htmlFor="is_retirement" style={{ marginBottom: '8px', display: 'block' }}>Account Type</label>
            <select
              id="is_retirement"
              value={newAccount.is_retirement ? 'yes' : 'no'}
              onChange={(e) => setNewAccount({ ...newAccount, is_retirement: e.target.value === 'yes' })}
              className="input-modern"
            >
              <option value="no">Standard</option>
              <option value="yes">Retirement</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="account_number" style={{ marginBottom: '8px', display: 'block' }}>Account Number</label>
            <input
              id="account_number"
              type="text"
              placeholder="Optional - account number or identifier"
              value={newAccount.account_number}
              onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
              className="input-modern"
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
          <div></div>
          <div>
            <button onClick={handleCreateAccount} className="btn-primary-modern">Add Account</button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', fontWeight: 'bold', fontSize: '1.2em' }}>Existing Accounts</h3>
        {accounts.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No accounts defined. Add an account above.</p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="accounts-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '100px', padding: '8px', textAlign: 'left' }}>Owner</th>
                  <th style={{ minWidth: '150px', padding: '8px', textAlign: 'left' }}>Brokerage</th>
                  <th style={{ minWidth: '250px', padding: '8px', textAlign: 'left' }}>Account Name</th>
                  <th style={{ minWidth: '150px', padding: '8px', textAlign: 'left' }}>Account Number</th>
                  <th style={{ minWidth: '100px', padding: '8px', textAlign: 'left' }}>Retirement</th>
                  <th style={{ minWidth: '120px', padding: '8px', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    {editingAccount?.id === account.id ? (
                      <>
                        <td style={{ padding: '8px' }}>
                          {account.owner_id === currentUser?.id ? (
                            <span style={{ color: '#28a745', fontWeight: 'bold' }}>Me</span>
                          ) : (
                            <span style={{ color: '#6c757d' }}>{account.owner_email ? account.owner_email.split('@')[0] : 'Other User'}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px' }}>
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
                        <td style={{ padding: '8px' }}>
                          <input
                            type="text"
                            value={editingAccount.account_name}
                            onChange={(e) => setEditingAccount({ ...editingAccount, account_name: e.target.value })}
                            className="input-modern"
                            style={{ width: '100%', fontSize: '0.9em', padding: '6px' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="text"
                            value={editingAccount.account_number || ''}
                            onChange={(e) => setEditingAccount({ ...editingAccount, account_number: e.target.value })}
                            className="input-modern"
                            style={{ width: '100%', fontSize: '0.9em', padding: '6px' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
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
                        <td style={{ padding: '8px' }}>
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
                        <td style={{ padding: '8px' }}>
                          {account.owner_id === currentUser?.id ? (
                            <span style={{ color: '#28a745', fontWeight: 'bold' }}>Me</span>
                          ) : (
                            <span style={{ color: '#6c757d' }} title={account.owner_email || 'Authorized Access'}>
                              {account.owner_email ? account.owner_email.split('@')[0] : 'Other User'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px' }}>
                          {account.brokerage_id ? (
                            brokerages.find(b => b.id === account.brokerage_id)?.name || '-'
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={{ fontWeight: 500, padding: '8px' }}>{account.account_name}</td>
                        <td style={{ padding: '8px' }}>{account.account_number || '-'}</td>
                        <td style={{ padding: '8px' }}>{account.is_retirement ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '8px' }}>
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
                                  onClick={() => handleDeleteAccount(account.id, account.account_name)} 
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
        )}
      </div>

      <div className="settings-page-actions">
        <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onRetain: null, title: '' })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        onRetain={confirmDialog.onRetain}
        title={confirmDialog.title}
        message={confirmDialog.message}
        showCancel={confirmDialog.showCancel}
        showRetain={confirmDialog.showRetain}
        showCascadeOption={confirmDialog.showCascadeOption}
        cascadeMessage={confirmDialog.cascadeMessage}
        cancelText={confirmDialog.cancelText}
        confirmText={confirmDialog.confirmText}
        retainText={confirmDialog.retainText}
      />
    </div>
  );
};

export default AccountsSettingsPage;


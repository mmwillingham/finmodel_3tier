import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthorizedUsersService from '../services/authorizedUsers.service';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import { useNavigate } from 'react-router-dom';
import './SettingsPages.css';

const AccountSwitcherPage = () => {
    const { currentUser, viewingUserId, setViewingUserId } = useAuth();
    const [accessibleAccounts, setAccessibleAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'success' or 'error'
    const navigate = useNavigate();

    useSettingsBackButton();

    useEffect(() => {
        const loadAccessibleAccounts = async () => {
            if (!currentUser) return;
            
            setLoading(true);
            try {
                const receivedAccess = await AuthorizedUsersService.listReceivedAccess();
                
                const accounts = [
                    {
                        id: currentUser.id,
                        email: currentUser.email,
                        label: 'My Account',
                        isOwn: true,
                    }
                ];
                
                if (receivedAccess && Array.isArray(receivedAccess)) {
                    receivedAccess.forEach(access => {
                        const email = access.primary_user_email || (access.primary_user && access.primary_user.email);
                        if (email && access.primary_user_id) {
                            // Only include users where we have financial_data_permission
                            // Users with only document_vault_permission should NOT appear here
                            // They can access documents through the Documents page/section only
                            if (access.financial_data_permission) {
                                accounts.push({
                                    id: access.primary_user_id,
                                    email: email,
                                    label: email,
                                    isOwn: false,
                                });
                            }
                        }
                    });
                }
                
                setAccessibleAccounts(accounts);
            } catch (error) {
                console.error('Error loading accessible accounts:', error);
                setMessage('Failed to load accessible accounts. Please try again.');
                setMessageType('error');
            } finally {
                setLoading(false);
            }
        };

        loadAccessibleAccounts();
    }, [currentUser]);

    const handleAccountChange = (e) => {
        const selectedId = parseInt(e.target.value);
        
        if (selectedId === currentUser.id) {
            setViewingUserId(null);
            setMessage('✓ Switched to viewing your own account data. All data sections have been refreshed.');
        } else {
            const selectedAccount = accessibleAccounts.find(acc => acc.id === selectedId);
            setViewingUserId(selectedId);
            setMessage(`✓ Switched to viewing ${selectedAccount?.email || 'selected account'}'s data. Assets, liabilities, accounts, and projections have been refreshed to show data from this account.`);
        }
        setMessageType('success');
        
        // Refresh the page data by navigating to home after showing message
        // This ensures all components reload with the new viewingUserId
        // The viewingUserId is now saved to localStorage so it persists across reloads
        setTimeout(() => {
            // Navigate to home page which will refresh all data with new viewingUserId
            window.location.href = '/';
        }, 1500);
        
        // Clear message after 5 seconds (though page will refresh before this)
        setTimeout(() => {
            setMessage('');
            setMessageType('');
        }, 5000);
    };

    // Default to current user's account (My Account) if viewingUserId is not explicitly set
    // Note: viewingUserId might be null (viewing own account) or a number (viewing another account)
    // We want the select to default to currentUser.id when viewingUserId is null
    const currentViewingId = viewingUserId !== null && viewingUserId !== undefined ? viewingUserId : (currentUser?.id || null);
    const currentAccount = accessibleAccounts.find(acc => acc.id === currentViewingId) || accessibleAccounts.find(acc => acc.id === currentUser?.id) || accessibleAccounts[0];
    
    // Debug: log the values to see what's happening
    console.log('AccountSwitcher - viewingUserId:', viewingUserId, 'currentUser?.id:', currentUser?.id, 'currentViewingId:', currentViewingId, 'accessibleAccounts:', accessibleAccounts);
    console.log('AccountSwitcher - Select value will be:', viewingUserId === null || viewingUserId === undefined ? (currentUser?.id || accessibleAccounts[0]?.id || '') : (viewingUserId || currentUser?.id || ''));

    return (
        <div className="settings-page-container">
            <h2>Switch Account View</h2>
            
            {message && (
                <div className={`message ${messageType === 'success' ? 'success-message' : 'error-message'}`} style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    backgroundColor: messageType === 'success' ? '#d4edda' : '#f8d7da',
                    color: messageType === 'success' ? '#155724' : '#721c24',
                    border: `1px solid ${messageType === 'success' ? '#c3e6cb' : '#f5c6cb'}`
                }}>
                    {message}
                </div>
            )}

            <div className="setting-group">
                <h3>Currently Viewing</h3>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                    Select which account's data you want to view. This affects what you see in Assets, Liabilities, Accounts, and other data sections.
                </p>
                
                {loading ? (
                    <div>Loading accounts...</div>
                ) : accessibleAccounts.length <= 1 ? (
                    <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '6px', color: '#666' }}>
                        <p>You currently only have access to your own account.</p>
                        <p style={{ marginTop: '10px', fontSize: '0.9em' }}>
                            Other users can grant you access to their data through the <strong>Authorized Users</strong> settings page.
                        </p>
                    </div>
                ) : (
                    <div>
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="account-switcher-select" style={{ 
                                display: 'block', 
                                marginBottom: '8px', 
                                fontWeight: 600,
                                fontSize: '14px'
                            }}>
                                Viewing Account:
                            </label>
                            <select
                                id="account-switcher-select"
                                value={(() => {
                                    // If viewingUserId is null or undefined, default to current user's account (My Account)
                                    if (viewingUserId === null || viewingUserId === undefined) {
                                        return currentUser?.id || accessibleAccounts[0]?.id || '';
                                    }
                                    // Otherwise, use the viewingUserId (user is viewing another account)
                                    return viewingUserId || currentUser?.id || '';
                                })()}
                                onChange={handleAccountChange}
                                style={{
                                    width: '100%',
                                    maxWidth: '400px',
                                    padding: '10px 12px',
                                    border: '1px solid #ced4da',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    backgroundColor: 'white',
                                    position: 'relative',
                                    zIndex: 1
                                }}
                            >
                                {accessibleAccounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div style={{ 
                            padding: '16px', 
                            background: viewingUserId ? '#fff3cd' : '#d1ecf1', 
                            borderRadius: '6px',
                            border: `1px solid ${viewingUserId ? '#ffc107' : '#bee5eb'}`,
                            marginTop: '16px'
                        }}>
                            <strong style={{ display: 'block', marginBottom: '8px' }}>
                                {viewingUserId ? '⚠️ Viewing Another Account' : '✓ Viewing Your Account'}
                            </strong>
                            <p style={{ margin: 0, fontSize: '0.9em', color: '#666' }}>
                                {viewingUserId 
                                    ? `You are currently viewing data from ${currentAccount?.email || 'another account'}. Assets, liabilities, accounts, and projections will show data from this account. You cannot edit profile settings or other account-specific information while viewing another account.`
                                    : `You are viewing your own account data. All assets, liabilities, and other financial data shown are from your account.`
                                }
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountSwitcherPage;

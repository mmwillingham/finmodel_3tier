import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthorizedUsersService from '../services/authorizedUsers.service';
import './AccountSwitcher.css';

const AccountSwitcher = ({ compact = false }) => {
    const { currentUser, viewingUserId, setViewingUserId } = useAuth();
    const [accessibleAccounts, setAccessibleAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAccessibleAccounts = async () => {
            if (!currentUser) return;
            
            setLoading(true);
            try {
                // Get list of primary users that have granted access
                const receivedAccess = await AuthorizedUsersService.listReceivedAccess();
                console.log('DEBUG AccountSwitcher - receivedAccess:', receivedAccess);
                
                // Build list: own account + authorized accounts
                const accounts = [
                    {
                        id: currentUser.id,
                        email: currentUser.email,
                        label: 'My Account',
                        isOwn: true,
                    }
                ];
                
                // Add authorized accounts
                if (receivedAccess && Array.isArray(receivedAccess)) {
                    receivedAccess.forEach(access => {
                        console.log('DEBUG AccountSwitcher - processing access:', access);
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
                
                console.log('DEBUG AccountSwitcher - final accounts list:', accounts);
                setAccessibleAccounts(accounts);
            } catch (error) {
                console.error('Error loading accessible accounts:', error);
                console.error('Error details:', error.response?.data || error.message);
                // On error, at least show own account
                setAccessibleAccounts([{
                    id: currentUser.id,
                    email: currentUser.email,
                    label: 'My Account',
                    isOwn: true,
                }]);
            } finally {
                setLoading(false);
            }
        };

        loadAccessibleAccounts();
    }, [currentUser]);

    // Always show loading state for debugging
    if (loading) {
        return (
            <div className={`account-switcher ${compact ? 'compact' : ''}`}>
                <label>{compact ? 'Account:' : 'Viewing Account:'}</label>
                <span style={{ marginLeft: '8px', fontSize: '0.9em' }}>Loading...</span>
            </div>
        );
    }
    
    // Show debug info if only one account - but still show it
    if (accessibleAccounts.length <= 1) {
        console.log('DEBUG AccountSwitcher - Only one account found. Accounts:', accessibleAccounts);
        console.log('DEBUG AccountSwitcher - Current user:', currentUser);
        // Still show switcher but disabled/readonly when only one account
        return (
            <div className={`account-switcher ${compact ? 'compact' : ''}`} style={{ opacity: accessibleAccounts.length === 1 ? 0.7 : 1 }}>
                <label htmlFor="account-switcher-select">{compact ? 'Account:' : 'Viewing Account:'}</label>
                <select
                    id="account-switcher-select"
                    value={currentUser?.id || ''}
                    disabled={true}
                    className="account-switcher-select"
                    style={{ opacity: 1, cursor: 'not-allowed' }}
                >
                    <option value={currentUser?.id}>
                        {accessibleAccounts[0]?.label || currentUser?.email || 'Unknown'}
                    </option>
                </select>
                {accessibleAccounts.length === 0 && (
                    <span style={{ fontSize: '0.75em', color: '#dc3545', marginLeft: '8px' }}>
                        (No accounts loaded)
                    </span>
                )}
            </div>
        );
    }

    const currentViewingId = viewingUserId || currentUser.id;
    const currentAccount = accessibleAccounts.find(acc => acc.id === currentViewingId) || accessibleAccounts[0];

    const handleChange = (e) => {
        const selectedId = parseInt(e.target.value);
        if (selectedId === currentUser.id) {
            setViewingUserId(null); // null means view own data
        } else {
            setViewingUserId(selectedId);
        }
    };

    return (
        <div className={`account-switcher ${compact ? 'compact' : ''}`}>
            <label htmlFor="account-switcher-select">{compact ? 'Account:' : 'Viewing Account:'}</label>
            <select
                id="account-switcher-select"
                value={currentViewingId}
                onChange={handleChange}
                className="account-switcher-select"
            >
                {accessibleAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                        {account.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default AccountSwitcher;

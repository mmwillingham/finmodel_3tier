import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthorizedUsersService from '../services/authorizedUsers.service';
import './AccountSwitcher.css';

const AccountSwitcher = () => {
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
                receivedAccess.forEach(access => {
                    const email = access.primary_user_email || (access.primary_user && access.primary_user.email);
                    if (email) {
                        accounts.push({
                            id: access.primary_user_id,
                            email: email,
                            label: email,
                            isOwn: false,
                        });
                    }
                });
                
                setAccessibleAccounts(accounts);
            } catch (error) {
                console.error('Error loading accessible accounts:', error);
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

    // Show switcher even if loading (for debugging) or if there are multiple accounts
    if (loading) {
        return (
            <div className="account-switcher">
                <label>Loading accounts...</label>
            </div>
        );
    }
    
    if (accessibleAccounts.length <= 1) {
        // Don't show switcher if only one account
        return null;
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
        <div className="account-switcher">
            <label htmlFor="account-switcher-select">Viewing Account:</label>
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

import React from 'react';
import { useAuth } from '../context/AuthContext';
import './SettingsDropdownMenu.css'; // New CSS file for the dropdown

const SettingsDropdownMenu = ({ onSelect, onClose }) => {
    const { currentUser, viewingUserId } = useAuth();

    const handleItemClick = (e, path) => {
        e.preventDefault();
        e.stopPropagation();
        onClose(); // Close dropdown first
        onSelect(path); // Then navigate
    };

    return (
        <div className="settings-dropdown-menu" onMouseLeave={onClose}> {/* Close on mouse leave */}
            <button onClick={(e) => handleItemClick(e, '/settings/account-switcher')}>Switch Account View</button>
            {/* Hide all other settings when viewing another user's account */}
            {!viewingUserId && (
                <>
                    <button onClick={(e) => handleItemClick(e, '/settings/profile')}>Profile</button>
                    <button onClick={(e) => handleItemClick(e, '/settings/categories')}>Categories</button>
                    <button onClick={(e) => handleItemClick(e, '/settings/accounts')}>Accounts</button>
                    <button onClick={(e) => handleItemClick(e, '/settings/application')}>Application</button>
                    <button onClick={(e) => handleItemClick(e, '/settings/auto-disbursements')}>Automatic Transfers</button>
                    <button onClick={(e) => handleItemClick(e, '/settings/export-import')}>Export/Import</button>
                    <button onClick={(e) => handleItemClick(e, '/settings/refer-a-friend')}>Refer a Friend</button>
                    <button onClick={(e) => handleItemClick(e, '/settings/authorized-users')}>Authorized Users</button>
                    <button onClick={(e) => handleItemClick(e, '/settings/help')}>Help</button>
                    {/* Admin-only items - placed after Help */}
                    {currentUser && currentUser.is_admin && (
                        <>
                            <button onClick={(e) => handleItemClick(e, '/settings/admin/users')}>User Management (Admin)</button>
                            <button onClick={(e) => handleItemClick(e, '/settings/admin/global-categories')}>Default Categories (Admin)</button>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default SettingsDropdownMenu;

import React from 'react';
import { useAuth } from '../context/AuthContext';
import './SettingsDropdownMenu.css'; // New CSS file for the dropdown

const SettingsDropdownMenu = ({ onSelect, onClose }) => {
    const { currentUser } = useAuth();

    const handleItemClick = (e, path) => {
        e.preventDefault();
        e.stopPropagation();
        onClose(); // Close dropdown first
        onSelect(path); // Then navigate
    };

    return (
        <div className="settings-dropdown-menu" onMouseLeave={onClose}> {/* Close on mouse leave */}
            <button onClick={(e) => handleItemClick(e, '/settings/application')}>Application</button>
            <button onClick={(e) => handleItemClick(e, '/settings/profile')}>Profile</button>
            <button onClick={(e) => handleItemClick(e, '/settings/categories')}>Categories</button>
            <button onClick={(e) => handleItemClick(e, '/settings/accounts')}>Accounts</button>
            {currentUser && currentUser.is_admin && (
                <button onClick={(e) => handleItemClick(e, '/settings/admin/users')}>User Management</button>
            )}
            {currentUser && currentUser.is_admin && (
                <button onClick={(e) => handleItemClick(e, '/settings/admin/global-categories')}>Default Categories</button>
            )}
            <button onClick={(e) => handleItemClick(e, '/settings/help')}>Help</button>
        </div>
    );
};

export default SettingsDropdownMenu;

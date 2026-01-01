import React from 'react';
import { useAuth } from '../context/AuthContext';
import './SettingsDropdownMenu.css'; // New CSS file for the dropdown

const SettingsDropdownMenu = ({ onSelect, onClose }) => {
    const { currentUser } = useAuth();

    const handleItemClick = (path) => {
        onSelect(path);
        onClose();
    };

    return (
        <div className="settings-dropdown-menu" onMouseLeave={onClose}> {/* Close on mouse leave */}
            <button onClick={() => handleItemClick('/settings/application')}>Application</button>
            <button onClick={() => handleItemClick('/settings/profile')}>Profile</button>
            <button onClick={() => handleItemClick('/settings/categories')}>Categories</button>
            {currentUser && currentUser.is_admin && (
                <button onClick={() => handleItemClick('/settings/admin/users')}>User Management</button>
            )}
            {currentUser && currentUser.is_admin && (
                <button onClick={() => handleItemClick('/settings/admin/global-categories')}>Default Categories</button>
            )}
            <button onClick={() => handleItemClick('/settings/help')}>Help</button>
        </div>
    );
};

export default SettingsDropdownMenu;

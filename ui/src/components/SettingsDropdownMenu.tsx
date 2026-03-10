import React, { type MouseEvent, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import './SettingsDropdownMenu.css';

interface SettingsDropdownMenuProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  onLogout: () => void;
  children?: ReactNode;
}

const SettingsDropdownMenu: React.FC<SettingsDropdownMenuProps> = ({ onSelect, onClose, onLogout }) => {
  const { currentUser, viewingUserId } = useAuth();

  const handleItemClick = (event: MouseEvent<HTMLButtonElement>, path: string) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    onSelect(path);
  };

  return (
    <div className="settings-dropdown-menu">
      <button onClick={(event: any) => handleItemClick(event, '/settings/account-switcher')}>Switch Account</button>
      {!viewingUserId && (
        <>
          <button onClick={(event: any) => handleItemClick(event, '/settings/profile')} data-tour-id="settings-profile">
            Profile
          </button>
          <button onClick={(event: any) => handleItemClick(event, '/settings/application')}>Application</button>
          <button onClick={(event: any) => handleItemClick(event, '/settings/export-import')}>Export/Import</button>
          <button onClick={(event: any) => handleItemClick(event, '/settings/refer-a-friend')}>Refer a Friend</button>
          <button
            onClick={(event: any) => handleItemClick(event, '/settings/authorized-users')}
            data-tour-id="settings-authorized-users"
          >
            Authorized Users
          </button>
          <button onClick={(event: any) => handleItemClick(event, '/settings/help')}>Help</button>
          <button onClick={(event: any) => handleItemClick(event, '/settings/about')}>About</button>
          {currentUser?.is_admin && (
            <>
              <button onClick={(event: any) => handleItemClick(event, '/settings/admin/users')}>User Management (Admin)</button>
              <button onClick={(event: any) => handleItemClick(event, '/settings/admin/global-categories')}>Default Categories (Admin)</button>
              <button onClick={(event: any) => handleItemClick(event, '/settings/admin/default-folders')}>Default Folders (Admin)</button>
              <button onClick={(event: any) => handleItemClick(event, '/settings/admin/document-vault-defaults')}>Document Vault Defaults (Admin)</button>
            </>
          )}
        </>
      )}
      <button
        onClick={(event: any) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          onLogout();
        }}
      >
        Logout
      </button>
    </div>
  );
};

export default SettingsDropdownMenu;

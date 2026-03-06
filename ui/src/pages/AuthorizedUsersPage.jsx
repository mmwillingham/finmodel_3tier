import React, { useState, useEffect } from 'react';
import AuthorizedUsersService from '../services/authorizedUsers.service';
import ConfirmDialog from '../components/ConfirmDialog';
import './AuthorizedUsersPage.css';

const AuthorizedUsersPage = () => {
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [receivedAccess, setReceivedAccess] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('granted'); // 'granted' or 'received'
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Form states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newTemporaryPassword, setNewTemporaryPassword] = useState('');
  const [newPermissions, setNewPermissions] = useState({
    financial_data_permission: null,
    document_vault_permission: null
  });
  
  const [editUser, setEditUser] = useState(null);
  const [editPermissions, setEditPermissions] = useState({});
  
  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'granted') {
        const data = await AuthorizedUsersService.listAuthorizedUsers();
        setAuthorizedUsers(data);
      } else {
        const data = await AuthorizedUsersService.listReceivedAccess();
        setReceivedAccess(data);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      alert('Please enter an email address');
      return;
    }
    
    // Check that at least one permission is set
    const hasPermission = Object.values(newPermissions).some(p => p !== null);
    if (!hasPermission) {
      alert('Please grant at least one permission');
      return;
    }
    
    try {
      const payload = {
        authorized_user_email: newUserEmail.trim(),
        ...newPermissions
      };
      
      // Include temporary_password only if provided
      if (newTemporaryPassword.trim()) {
        payload.temporary_password = newTemporaryPassword.trim();
      }
      
      await AuthorizedUsersService.createAuthorizedUser(payload);
      setNewUserEmail('');
      setNewTemporaryPassword('');
      setNewPermissions({
        financial_data_permission: null,
        document_vault_permission: null
      });
      setShowAddModal(false);
      loadData();
    } catch (err) {
      alert('Failed to add authorized user: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEditUser = (user) => {
    setEditUser(user);
    setEditPermissions({
      financial_data_permission: user.financial_data_permission,
      document_vault_permission: user.document_vault_permission
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      await AuthorizedUsersService.updateAuthorizedUser(editUser.id, editPermissions);
      setShowEditModal(false);
      setEditUser(null);
      loadData();
    } catch (err) {
      alert('Failed to update permissions: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteUser = (user) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Authorized User',
      message: `Are you sure you want to remove access for ${user.authorized_user_email}?`,
      onConfirm: async () => {
        try {
          await AuthorizedUsersService.deleteAuthorizedUser(user.id);
          loadData();
        } catch (err) {
          alert('Failed to remove authorized user: ' + (err.response?.data?.detail || err.message));
        }
      }
    });
  };

  const handlePermissionChange = (permissionType, value, isEdit = false) => {
    if (isEdit) {
      setEditPermissions(prev => ({ ...prev, [permissionType]: value === 'none' ? null : value }));
    } else {
      setNewPermissions(prev => ({ ...prev, [permissionType]: value === 'none' ? null : value }));
    }
  };

  const PermissionSelector = ({ permissionType, value, onChange, label }) => (
    <div className="permission-selector">
      <label>{label}:</label>
      <select value={value || 'none'} onChange={(e) => onChange(permissionType, e.target.value)}>
        <option value="none">No Access</option>
        <option value="view">View Only</option>
        <option value="edit">View & Edit</option>
      </select>
    </div>
  );

  return (
    <div className="authorized-users-page">
      <div className="authorized-users-shell page-shell-card">
        <div className="page-header">
          <h1>🔐 Authorized Users</h1>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            + Add Authorized User
          </button>
        </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'granted' ? 'active' : ''}`}
          onClick={() => setActiveTab('granted')}
        >
          Users I've Authorized
        </button>
        <button
          className={`tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          Access I've Received
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <div className="users-table-container">
          {activeTab === 'granted' ? (
            authorizedUsers.length === 0 ? (
              <div className="empty-state">
                <p>No authorized users yet</p>
                <p>Click the button below to grant access to another user</p>
                <button onClick={() => setShowAddModal(true)} className="btn-primary empty-state-button">
                  + Add Authorized User
                </button>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Financial Data</th>
                      <th>Document Vault</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authorizedUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div>{user.authorized_user_email}</div>
                          {user.authorized_user_id && (
                            <div style={{ fontSize: '0.9em', color: '#666', marginTop: '4px' }}>
                              User ID: {user.authorized_user_id}
                            </div>
                          )}
                        </td>
                        <td>{user.financial_data_permission || '-'}</td>
                        <td>{user.document_vault_permission || '-'}</td>
                        <td className="actions-cell">
                          <button onClick={() => handleEditUser(user)} className="btn-icon" title="Edit">
                            ✏️
                          </button>
                          <button onClick={() => handleDeleteUser(user)} className="btn-icon" title="Remove">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            receivedAccess.length === 0 ? (
              <div className="empty-state">
                <p>No received access</p>
                <p>Other users can grant you access to their data</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Primary User</th>
                      <th>Financial Data</th>
                      <th>Document Vault</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivedAccess.map((access) => (
                      <tr key={access.id}>
                        <td>
                          {(access.primary_user_email || access.primary_user?.email) && (
                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                              {access.primary_user_email || access.primary_user?.email}
                            </div>
                          )}
                          <div style={{ fontSize: '0.9em', color: '#666' }}>
                            User ID: {access.primary_user_id}
                          </div>
                        </td>
                        <td>{access.financial_data_permission || '-'}</td>
                        <td>{access.document_vault_permission || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

        {/* Add User Modal */}
        {showAddModal && (
          <div className="modal-overlay" onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
            }
          }}>
            <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
              <h2>Add Authorized User</h2>
              <p className="modal-hint">
                If the user is not registered, you can optionally create their account by providing a temporary password.
                If the user is already registered, leave the password field empty.
              </p>
              <input
                type="email"
                placeholder="User email address"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="form-input"
              />
              <input
                type="password"
                placeholder="Temporary password (optional - creates account if user doesn't exist)"
                value={newTemporaryPassword}
                onChange={(e) => setNewTemporaryPassword(e.target.value)}
                className="form-input"
                style={{ marginTop: '10px' }}
              />
              
              <div className="permissions-section" style={{ marginTop: '20px' }}>
                <h3>Permissions</h3>
                <PermissionSelector
                  permissionType="financial_data_permission"
                  value={newPermissions.financial_data_permission}
                  onChange={handlePermissionChange}
                  label="Financial Data (Accounts, Items, Projections, Charts)"
                />
                <PermissionSelector
                  permissionType="document_vault_permission"
                  value={newPermissions.document_vault_permission}
                  onChange={handlePermissionChange}
                  label="Document Vault"
                />
              </div>
              
              <div className="modal-actions">
                <button onClick={() => setShowAddModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleAddUser} className="btn-primary">
                  Add User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editUser && (
          <div className="modal-overlay" onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
            }
          }}>
            <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
              <h2>Edit Permissions for {editUser.authorized_user_email}</h2>
              
              <div className="permissions-section">
                <h3>Permissions</h3>
                <PermissionSelector
                  permissionType="financial_data_permission"
                  value={editPermissions.financial_data_permission}
                  onChange={(type, val) => handlePermissionChange(type, val, true)}
                  label="Financial Data (Accounts, Items, Projections, Charts)"
                />
                <PermissionSelector
                  permissionType="document_vault_permission"
                  value={editPermissions.document_vault_permission}
                  onChange={(type, val) => handlePermissionChange(type, val, true)}
                  label="Document Vault"
                />
              </div>
              
              <div className="modal-actions">
                <button onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
};

export default AuthorizedUsersPage;


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
  const [newPermissions, setNewPermissions] = useState({
    accounts_permission: null,
    items_permission: null,
    projections_permission: null,
    charts_permission: null,
    documents_permission: null
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
      console.error(err);
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
      await AuthorizedUsersService.createAuthorizedUser({
        authorized_user_email: newUserEmail.trim(),
        ...newPermissions
      });
      setNewUserEmail('');
      setNewPermissions({
        accounts_permission: null,
        items_permission: null,
        projections_permission: null,
        charts_permission: null,
        documents_permission: null
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
      accounts_permission: user.accounts_permission,
      items_permission: user.items_permission,
      projections_permission: user.projections_permission,
      charts_permission: user.charts_permission,
      documents_permission: user.documents_permission
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
      <div className="page-header">
        <h1>🔐 Authorized Users</h1>
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
                <p>Click "Add Authorized User" to grant access to another user</p>
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Accounts</th>
                    <th>Items</th>
                    <th>Projections</th>
                    <th>Charts</th>
                    <th>Documents</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authorizedUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.authorized_user_email}</td>
                      <td>{user.accounts_permission || '-'}</td>
                      <td>{user.items_permission || '-'}</td>
                      <td>{user.projections_permission || '-'}</td>
                      <td>{user.charts_permission || '-'}</td>
                      <td>{user.documents_permission || '-'}</td>
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
            )
          ) : (
            receivedAccess.length === 0 ? (
              <div className="empty-state">
                <p>No received access</p>
                <p>Other users can grant you access to their data</p>
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Primary User ID</th>
                    <th>Accounts</th>
                    <th>Items</th>
                    <th>Projections</th>
                    <th>Charts</th>
                    <th>Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedAccess.map((access) => (
                    <tr key={access.id}>
                      <td>User ID: {access.primary_user_id}</td>
                      <td>{access.accounts_permission || '-'}</td>
                      <td>{access.items_permission || '-'}</td>
                      <td>{access.projections_permission || '-'}</td>
                      <td>{access.charts_permission || '-'}</td>
                      <td>{access.documents_permission || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Authorized User</h2>
            <p className="modal-hint">The user must already be registered in the system.</p>
            <input
              type="email"
              placeholder="User email address"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="form-input"
            />
            
            <div className="permissions-section">
              <h3>Permissions</h3>
              <PermissionSelector
                permissionType="accounts_permission"
                value={newPermissions.accounts_permission}
                onChange={handlePermissionChange}
                label="Accounts"
              />
              <PermissionSelector
                permissionType="items_permission"
                value={newPermissions.items_permission}
                onChange={handlePermissionChange}
                label="Items (Assets, Liabilities, Cash Flow)"
              />
              <PermissionSelector
                permissionType="projections_permission"
                value={newPermissions.projections_permission}
                onChange={handlePermissionChange}
                label="Projections"
              />
              <PermissionSelector
                permissionType="charts_permission"
                value={newPermissions.charts_permission}
                onChange={handlePermissionChange}
                label="Charts"
              />
              <PermissionSelector
                permissionType="documents_permission"
                value={newPermissions.documents_permission}
                onChange={handlePermissionChange}
                label="Documents"
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
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Permissions for {editUser.authorized_user_email}</h2>
            
            <div className="permissions-section">
              <h3>Permissions</h3>
              <PermissionSelector
                permissionType="accounts_permission"
                value={editPermissions.accounts_permission}
                onChange={(type, val) => handlePermissionChange(type, val, true)}
                label="Accounts"
              />
              <PermissionSelector
                permissionType="items_permission"
                value={editPermissions.items_permission}
                onChange={(type, val) => handlePermissionChange(type, val, true)}
                label="Items (Assets, Liabilities, Cash Flow)"
              />
              <PermissionSelector
                permissionType="projections_permission"
                value={editPermissions.projections_permission}
                onChange={(type, val) => handlePermissionChange(type, val, true)}
                label="Projections"
              />
              <PermissionSelector
                permissionType="charts_permission"
                value={editPermissions.charts_permission}
                onChange={(type, val) => handlePermissionChange(type, val, true)}
                label="Charts"
              />
              <PermissionSelector
                permissionType="documents_permission"
                value={editPermissions.documents_permission}
                onChange={(type, val) => handlePermissionChange(type, val, true)}
                label="Documents"
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


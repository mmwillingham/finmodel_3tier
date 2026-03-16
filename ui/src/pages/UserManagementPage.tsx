import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import './SettingsPages.css'; // General CSS for settings pages

interface ConfirmDialogState {
  isOpen: boolean;
  message: string;
  onConfirm: (() => void | Promise<void>) | null;
  title: string;
  confirmText?: string;
  showCancel?: boolean;
}

const UserManagementPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserMustChangePassword, setNewUserMustChangePassword] = useState(true);
  const [newUserSubscriptionLevel, setNewUserSubscriptionLevel] = useState(2);

  const fetchUsers = useCallback(async () => {
    if (!currentUser || !currentUser.is_admin) {
      setError("Access Denied: You must be an administrator to view this page.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage('');
    try {
      const fetchedUsers = await AuthService.getAllManageableUsers();
      setUsers(fetchedUsers);
    } catch (error: any) {
      setError(`Failed to load users: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeleteUser = async (userId: any, userEmail: any) => {
    const userName = userEmail || `User ID ${userId}`;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete user ${userName} (ID: ${userId})? This action cannot be undone.`,
      onConfirm: async () => {
        setLoading(true);
        setMessage('');
        try {
          await AuthService.deleteUser(userId);
          setMessage(`User ${userName} deleted successfully.`);
          fetchUsers(); // Refresh the list
        } catch (error: any) {
          setMessage(`Failed to delete user ${userName}: ${error.response?.data?.detail || error.message}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSetAdminStatus = async (userId: any, userEmail: any, isAdmin: any) => {
    const userName = userEmail || `User ID ${userId}`;
    setConfirmDialog({
      isOpen: true,
      title: isAdmin ? 'Make Admin' : 'Revoke Admin Status',
      message: `Are you sure you want to ${isAdmin ? 'make' : 'revoke'} admin status for user ${userName} (ID: ${userId})?`,
      onConfirm: async () => {
        setLoading(true);
        setMessage('');
        try {
          await AuthService.setUserAdminStatus(userId, isAdmin);
          setMessage(`User ${userName} ${isAdmin ? 'made' : 'admin status revoked for'} successfully.`);
          fetchUsers(); // Refresh the list
        } catch (error: any) {
          setMessage(`Failed to update admin status for user ${userName}: ${error.response?.data?.detail || error.message}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSetSubscriptionLevel = async (userId: any, userEmail: any, subscriptionLevel: any) => {
    const userName = userEmail || `User ID ${userId}`;
    setConfirmDialog({
      isOpen: true,
      title: 'Update Subscription',
      message: `Set subscription for user ${userName} (ID: ${userId}) to level ${subscriptionLevel}?`,
      confirmText: 'Update',
      showCancel: true,
      onConfirm: async () => {
        setLoading(true);
        setMessage('');
        try {
          const targetUser = users.find((user: any) => user.id === userId);
          const isAdmin = targetUser ? targetUser.is_admin : false;
          await AuthService.setUserAdminStatus(userId, isAdmin, subscriptionLevel);
          setMessage(`Subscription updated for user ${userName}.`);
          fetchUsers();
        } catch (error: any) {
          setMessage(`Failed to update subscription for user ${userName}: ${error.response?.data?.detail || error.message}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCreateUser = async (e: any) => {
    e.preventDefault();
    if (!newUserPassword || newUserPassword.length < 8) {
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await AuthService.createUser(newUserEmail || null, newUserPassword, newUserMustChangePassword, newUserSubscriptionLevel);
      setMessage(`User ${newUserEmail || 'created'} created successfully.`);
      setShowCreateForm(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserMustChangePassword(true);
      setNewUserSubscriptionLevel(2);
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      setMessage(`Failed to create user: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  const formatDate = (dateString: any) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (field: any) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedUsers = [...users].sort((a: any, b: any) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Handle date strings
    if (sortField === 'created_at') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    // Handle string comparisons
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);

  if (!currentUser || !currentUser.is_admin) {
    return <div className="access-denied-message">Access Denied: You must be an administrator to view this page.</div>;
  }

  return (
    <div className="settings-page-container">
      <h2>User Management</h2>
      {message && <div className="message">{message}</div>}

      <div className="user-management-controls">
        <div className="sort-controls">
          <label htmlFor="sort-field">Sort by:</label>
          <select 
            id="sort-field" 
            value={sortField} 
            onChange={(e: any) => handleSort(e.target.value)}
          >
            <option value="email">User name</option>
            <option value="created_at">Date Created</option>
            <option value="id">ID</option>
            <option value="is_admin">Admin Status</option>
            <option value="subscription_level">Subscription</option>
          </select>
          <button 
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="sort-direction-btn"
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="create-user-btn"
          style={{ 
            marginLeft: 'auto', 
            background: 'linear-gradient(135deg, #0F2847 0%, #00a3e0 100%)', 
            color: 'white', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '4px', 
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'linear-gradient(135deg, #0F2847 0%, #00a3e0 100%)'; }}
        >
          {showCreateForm ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-user-form" style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h3>Create New User</h3>
          <form onSubmit={handleCreateUser}>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="new-user-email">User name:</label>
              <input
                id="new-user-email"
                name="new-user-email"
                autoComplete="off"
                type="text"
                value={newUserEmail}
                onChange={(e: any) => setNewUserEmail(e.target.value)}
                placeholder="Leave empty for users without email"
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="new-user-password">Temporary Password *:</label>
              <input
                id="new-user-password"
                name="new-user-password"
                autoComplete="off"
                type="password"
                value={newUserPassword}
                onChange={(e: any) => setNewUserPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>
                <input
                  name="new-user-must-change-password"
                  autoComplete="off"
                  type="checkbox"
                  checked={newUserMustChangePassword}
                  onChange={(e: any) => setNewUserMustChangePassword(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                Require password change on first login
              </label>
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="new-user-subscription">Subscription Level:</label>
              <select
                id="new-user-subscription"
                name="new-user-subscription"
                autoComplete="off"
                value={newUserSubscriptionLevel}
                onChange={(e: any) => setNewUserSubscriptionLevel(parseInt(e.target.value, 10))}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              >
                <option value={1}>Free</option>
                <option value={2}>Premium</option>
                <option value={3}>Pro</option>
              </select>
            </div>
            <div className="form-actions" style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="submit" 
                className="create-button" 
                disabled={loading}
                style={{ 
                  background: 'linear-gradient(135deg, #0F2847 0%, #00a3e0 100%)', 
                  color: 'white', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: '4px', 
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  opacity: loading ? 0.6 : 1
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!loading) e.currentTarget.style.filter = 'brightness(1.08)'; }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.filter = 'none'; }}
              >
                Create User
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowCreateForm(false);
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setNewUserMustChangePassword(true);
                }}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <>
          <div className="user-table-container">
            <div className="table-scroll">
              <table className="user-management-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th onClick={() => handleSort('email')} className="sortable-header">
                      User name {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('created_at')} className="sortable-header">
                      Date Created {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('is_admin')} className="sortable-header">
                      Admin {sortField === 'is_admin' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('subscription_level')} className="sortable-header">
                      Subscription {sortField === 'subscription_level' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.length > 0 ? (
                    currentUsers.map((user: any) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.email || 'N/A'}</td>
                        <td>{formatDate(user.created_at)}</td>
                        <td>{user.is_admin ? 'Yes' : 'No'}</td>
                        <td>
                          <select
                            value={user.subscription_level ?? 1}
                            onChange={(e: any) => handleSetSubscriptionLevel(user.id, user.email, parseInt(e.target.value, 10))}
                          >
                            <option value={1}>Free</option>
                            <option value={2}>Premium</option>
                            <option value={3}>Pro</option>
                          </select>
                        </td>
                        <td>
                          <div className="user-actions">
                            <button 
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="delete-user-btn"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => handleSetAdminStatus(user.id, user.email, !user.is_admin)}
                              className="set-admin-status-btn"
                            >
                              {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No other users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setCurrentPage((prev: any) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                onClick={() => setCurrentPage((prev: any) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      <div className="settings-page-actions">
        <button onClick={() => navigate('/app')} className="cancel-button">Cancel</button>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, title: '' })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
};

export default UserManagementPage;

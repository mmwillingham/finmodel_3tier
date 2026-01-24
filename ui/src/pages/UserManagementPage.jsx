import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import './SettingsPages.css'; // General CSS for settings pages

const UserManagementPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserMustChangePassword, setNewUserMustChangePassword] = useState(true);

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
    } catch (error) {
      setError(`Failed to load users: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeleteUser = async (userId, userEmail) => {
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
        } catch (error) {
          setMessage(`Failed to delete user ${userName}: ${error.response?.data?.detail || error.message}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSetAdminStatus = async (userId, userEmail, isAdmin) => {
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
        } catch (error) {
          setMessage(`Failed to update admin status for user ${userName}: ${error.response?.data?.detail || error.message}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserPassword || newUserPassword.length < 8) {
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await AuthService.createUser(newUserEmail || null, newUserPassword, newUserMustChangePassword);
      setMessage(`User ${newUserEmail || 'created'} created successfully.`);
      setShowCreateForm(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserMustChangePassword(true);
      fetchUsers(); // Refresh the list
    } catch (error) {
      setMessage(`Failed to create user: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  const formatDate = (dateString) => {
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
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
            onChange={(e) => handleSort(e.target.value)}
          >
            <option value="email">User name</option>
            <option value="created_at">Date Created</option>
            <option value="id">ID</option>
            <option value="is_admin">Admin Status</option>
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
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '4px', 
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#0056b3'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#007bff'}
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
                type="text"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Leave empty for users without email"
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="new-user-password">Temporary Password *:</label>
              <input
                id="new-user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>
                <input
                  type="checkbox"
                  checked={newUserMustChangePassword}
                  onChange={(e) => setNewUserMustChangePassword(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                Require password change on first login
              </label>
            </div>
            <div className="form-actions" style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="submit" 
                className="create-button" 
                disabled={loading}
                style={{ 
                  backgroundColor: '#007bff', 
                  color: 'white', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: '4px', 
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  opacity: loading ? 0.6 : 1
                }}
                onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#0056b3')}
                onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#007bff')}
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.length > 0 ? (
                    currentUsers.map(user => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.email || 'N/A'}</td>
                        <td>{formatDate(user.created_at)}</td>
                        <td>{user.is_admin ? 'Yes' : 'No'}</td>
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
                      <td colSpan="5">No other users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      <div className="settings-page-actions">
        <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
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

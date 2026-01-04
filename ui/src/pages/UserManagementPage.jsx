import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import './SettingsPages.css'; // General CSS for settings pages

const UserManagementPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

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
      console.error("Failed to fetch users:", error);
      setError(`Failed to load users: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUsers();
    // Fix browser back button - replace history entry so back goes to home
    window.history.replaceState(null, '', window.location.pathname);
  }, [fetchUsers]);

  useEffect(() => {
    // Intercept browser back button
    const handlePopState = (e) => {
      navigate('/', { replace: true });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete user ${userEmail} (ID: ${userId})? This action cannot be undone.`)) {
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await AuthService.deleteUser(userId);
      setMessage(`User ${userEmail} deleted successfully.`);
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error("Failed to delete user:", error);
      setMessage(`Failed to delete user ${userEmail}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetAdminStatus = async (userId, userEmail, isAdmin) => {
    if (!window.confirm(`Are you sure you want to ${isAdmin ? 'make' : 'revoke'} admin status for user ${userEmail} (ID: ${userId})?`)) {
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await AuthService.setUserAdminStatus(userId, isAdmin);
      setMessage(`User ${userEmail} ${isAdmin ? 'made' : 'admin status revoked for'} successfully.`);
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error("Failed to update admin status:", error);
      setMessage(`Failed to update admin status for user ${userEmail}: ${error.response?.data?.detail || error.message}`);
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
            <option value="email">Email</option>
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
      </div>

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <>
          <div className="user-table-container">
            <table className="user-management-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th onClick={() => handleSort('email')} className="sortable-header">
                    Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
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
                      <td>{user.email}</td>
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
    </div>
  );
};

export default UserManagementPage;

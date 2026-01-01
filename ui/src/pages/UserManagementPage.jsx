import React, { useState, useEffect, useCallback } from 'react';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import './SettingsPages.css'; // General CSS for settings pages

const UserManagementPage = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

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
  }, [fetchUsers]);

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

  if (!currentUser || !currentUser.is_admin) {
    return <div className="access-denied-message">Access Denied: You must be an administrator to view this page.</div>;
  }

  return (
    <div className="settings-page-container">
      <h2>User Management</h2>
      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <div className="user-list">
          {users.length > 0 ? (
            <ul>
              {users.map(user => (
                <li key={user.id}>
                  <span>
                    {user.email} (ID: {user.id})
                    {user.is_admin && <span className="admin-badge"> (Admin)</span>}
                  </span>
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
                </li>
              ))}
            </ul>
          ) : (
            <p>No other users found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;

import React, { useState, useEffect, useCallback } from 'react';
import SettingsService from '../services/settings.service';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';

import './SettingsModal.css';
import CategoryEditorModal from './CategoryEditorModal';

export const useCategoryModalStates = () => {
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  return {
    isAssetModalOpen, setIsAssetModalOpen,
    isLiabilityModalOpen, setIsLiabilityModalOpen,
    isIncomeModalOpen, setIsIncomeModalOpen,
    isExpenseModalOpen, setIsExpenseModalOpen,
    isChangePasswordModalOpen, setIsChangePasswordModalOpen,
  };
};

export default function SettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
  isAssetModalOpen, setIsAssetModalOpen,
  isLiabilityModalOpen, setIsLiabilityModalOpen,
  isIncomeModalOpen, setIsIncomeModalOpen,
  isExpenseModalOpen, setIsExpenseModalOpen,
  isChangePasswordModalOpen, setIsChangePasswordModalOpen,
}) {
  const { currentUser } = useAuth();
  const [inflationPercent, setInflationPercent] = useState(2.0);
  const [assetCategoriesState, setAssetCategoriesState] = useState([]);
  const [liabilityCategoriesState, setLiabilityCategoriesState] = useState([]);
  const [incomeCategoriesState, setIncomeCategoriesState] = useState([]);
  const [expenseCategoriesState, setExpenseCategoriesState] = useState([]);

  const [person1FirstName, setPerson1FirstName] = useState("");
  const [person1LastName, setPerson1LastName] = useState("");
  const [person2FirstName, setPerson2FirstName] = useState("");
  const [person2LastName, setPerson2LastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [email, setEmail] = useState("");
  const [projectionYears, setProjectionYears] = useState(30);
  const [showChartTotals, setShowChartTotals] = useState(true);

  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
    'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
    'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
    'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
    'WI', 'WY'
  ];
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('application');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const res = await SettingsService.getSettings();
      setInflationPercent(res.data.default_inflation_percent);
      setAssetCategoriesState(res.data.asset_categories ? res.data.asset_categories.split(',') : []);
      setLiabilityCategoriesState(res.data.liability_categories ? res.data.liability_categories.split(',') : []);
      setIncomeCategoriesState(res.data.income_categories ? res.data.income_categories.split(',') : []);
      setExpenseCategoriesState(res.data.expense_categories ? res.data.expense_categories.split(',') : []);
      setPerson1FirstName(res.data.person1_first_name || "");
      setPerson1LastName(res.data.person1_last_name || "");
      setPerson2FirstName(res.data.person2_first_name || "");
      setPerson2LastName(res.data.person2_last_name || "");
      setAddress(res.data.address || "");
      setCity(res.data.city || "");
      setState(res.data.state || "");
      setZipCode(res.data.zip_code || "");
      
      // Prioritize currentUser.email, then saved settings email, then empty string
      console.log('Debug - currentUser.email (from AuthContext):', currentUser?.email);
      console.log('Debug - res.data.email (from DB Settings):', res.data.email);
      setEmail(currentUser?.email || res.data.email || "");
      console.log('Debug - Email state after setEmail:', email);

      setProjectionYears(res.data.projection_years || 30);
      setShowChartTotals(res.data.show_chart_totals ?? true);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }, [currentUser]); // Added currentUser as a dependency

  const fetchUsers = useCallback(async () => {
    if (!currentUser || !currentUser.is_admin) return;

    setLoadingUsers(true);
    setAdminMessage('');
    try {
      const fetchedUsers = await AuthService.getAllManageableUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setAdminMessage(`Failed to load users: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingUsers(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      if (currentUser && currentUser.is_admin) {
        fetchUsers();
      }
    }
  }, [isOpen, loadSettings, currentUser, fetchUsers]);

  useEffect(() => {
    if (activeTab === 'admin' && currentUser && currentUser.is_admin) {
      fetchUsers();
    }
  }, [activeTab, currentUser, fetchUsers]);

  const handleSave = async () => {
    try {
      await SettingsService.updateSettings({
        default_inflation_percent: parseFloat(inflationPercent),
        asset_categories: assetCategoriesState.join(','),
        liability_categories: liabilityCategoriesState.join(','),
        income_categories: incomeCategoriesState.join(','),
        expense_categories: expenseCategoriesState.join(','),
        person1_first_name: person1FirstName,
        person1_last_name: person1LastName,
        person2_first_name: person2FirstName,
        person2_last_name: person2LastName,
        address: address,
        city: city,
        state: state,
        zip_code: zipCode,
        email: email, // This will save the currently displayed email
        projection_years: parseInt(projectionYears),
        show_chart_totals: showChartTotals,
      });
      setMessage('Settings saved successfully!');
      if (onSettingsSaved) {
        onSettingsSaved();
      }
      setTimeout(() => {
        setMessage('');
        onClose();
      }, 1500);
    } catch (e) {
      console.error('Failed to save settings', e);
      const errorMessage = e.response?.data?.detail || 'Error saving settings';
      setMessage(errorMessage);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete user ${userEmail} (ID: ${userId})? This action cannot be undone.`)) {
      return;
    }
    setLoadingUsers(true);
    setAdminMessage('');
    try {
      await AuthService.deleteUser(userId);
      setAdminMessage(`User ${userEmail} deleted successfully.`);
      fetchUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      setAdminMessage(`Failed to delete user ${userEmail}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSetAdminStatus = async (userId, userEmail, isAdmin) => {
    if (!window.confirm(`Are you sure you want to ${isAdmin ? 'make' : 'revoke'} admin status for user ${userEmail} (ID: ${userId})?`)) {
      return;
    }
    setLoadingUsers(true);
    setAdminMessage('');
    try {
      await AuthService.setUserAdminStatus(userId, isAdmin);
      setAdminMessage(`User ${userEmail} ${isAdmin ? 'made' : 'admin status revoked for'} successfully.`);
      fetchUsers();
    } catch (error) {
      console.error("Failed to update admin status:", error);
      setAdminMessage(`Failed to update admin status for user ${userEmail}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div>
      <div className="settings-modal-overlay" onClick={onClose}>
        <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
          <h2>Settings</h2>

          {message && <div className="message">{message}</div>}

          <div className="settings-tabs">
            <button
              className={activeTab === 'application' ? 'active' : ''}
              onClick={() => setActiveTab('application')}
            >
              Application
            </button>
            <button
              className={activeTab === 'profile' ? 'active' : ''}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
            <button
              className={activeTab === 'categories' ? 'active' : ''}
              onClick={() => setActiveTab('categories')}
            >
              Categories
            </button>
            {currentUser && currentUser.is_admin && (
              <button
                className={activeTab === 'admin' ? 'active' : ''}
                onClick={() => setActiveTab('admin')}
              >
                Admin
              </button>
            )}
          </div>

          <div className="settings-form">
            {activeTab === 'application' && (
              <div className="tab-content">
                <h3>Application</h3>
                <div className="setting-group">
                  <div>
                    <label htmlFor="default-inflation">
                      Default Inflation Rate (%)
                    </label>
                    <input
                      id="default-inflation"
                      type="number"
                      step="0.1"
                      value={inflationPercent}
                      onChange={(e) => setInflationPercent(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="projection-years">
                      Number of Years to Project
                    </label>
                    <input
                      id="projection-years"
                      type="number"
                      value={projectionYears}
                      onChange={(e) => setProjectionYears(e.target.value)}
                      placeholder="30"
                    />
                  </div>
                  <div className="checkbox-group">
                    <label htmlFor="show-chart-totals">
                      Show Chart Totals
                    </label>
                    <input
                      id="show-chart-totals"
                      type="checkbox"
                      checked={showChartTotals}
                      onChange={(e) => setShowChartTotals(e.target.checked)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="tab-content profile">
                <h3>Profile</h3>
                <div className="setting-group">
                  <div>
                    <label htmlFor="person1-first-name">
                      First Name
                    </label>
                    <input
                      id="person1-first-name"
                      type="text"
                      value={person1FirstName}
                      onChange={(e) => setPerson1FirstName(e.target.value)}
                      placeholder="First Name"
                    />
                  </div>
                  <div>
                    <label htmlFor="person1-last-name">
                      Last Name
                    </label>
                    <input
                      id="person1-last-name"
                      type="text"
                      value={person1LastName}
                      onChange={(e) => setPerson1LastName(e.target.value)}
                      placeholder="Last Name"
                    />
                  </div>
                  <div>
                    <label htmlFor="person2-first-name">
                      Spouse First Name
                    </label>
                    <input
                      id="person2-first-name"
                      type="text"
                      value={person2FirstName}
                      onChange={(e) => setPerson2FirstName(e.target.value)}
                      placeholder="Spouse First Name"
                    />
                  </div>
                  <div>
                    <label htmlFor="person2-last-name">
                      Spouse Last Name
                    </label>
                    <input
                      id="person2-last-name"
                      type="text"
                      value={person2LastName}
                      onChange={(e) => setPerson2LastName(e.target.value)}
                      placeholder="Spouse Last Name"
                    />
                  </div>
                  <div>
                    <label htmlFor="address">
                      Address
                    </label>
                    <input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Address"
                    />
                  </div>
                  <div>
                    <label htmlFor="city">
                      City
                    </label>
                    <input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label htmlFor="state">
                      State
                    </label>
                    <select
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    >
                      <option value="">Select State</option>
                      {states.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="zip-code">
                      Zip Code
                    </label>
                    <input
                      id="zip-code"
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="Zip Code"
                    />
                  </div>
                  <div>
                    <label htmlFor="email">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address"
                    />
                  </div>
                  <div>
                    <button type="button" className="change-password-btn" onClick={() => setIsChangePasswordModalOpen(true)}>Change Password</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="tab-content">
                <h3>Categories</h3>
                <div className="setting-group category-settings-group">
                  <div className="category-section-item">
                    <div className="category-header">
                      <label>Asset Categories</label>
                      <button type="button" onClick={() => {
                        setIsAssetModalOpen(true);
                      }}>Manage</button>
                    </div>
                    <div className="category-tags-display">
                      {assetCategoriesState.map((cat, index) => (
                        <span key={index} className="category-tag">{cat}</span>
                      ))}
                      {assetCategoriesState.length === 0 && <span className="no-categories-text">No asset categories defined.</span>}
                    </div>
                  </div>

                  <div className="category-section-item">
                    <div className="category-header">
                      <label>Liability Categories</label>
                      <button type="button" onClick={() => setIsLiabilityModalOpen(true)}>Manage</button>
                    </div>
                    <div className="category-tags-display">
                      {liabilityCategoriesState.map((cat, index) => (
                        <span key={index} className="category-tag">{cat}</span>
                      ))}
                      {liabilityCategoriesState.length === 0 && <span className="no-categories-text">No liability categories defined.</span>}
                    </div>
                  </div>

                  <div className="category-section-item">
                    <div className="category-header">
                      <label>Income Categories</label>
                      <button type="button" onClick={() => setIsIncomeModalOpen(true)}>Manage</button>
                    </div>
                    <div className="category-tags-display">
                      {incomeCategoriesState.map((cat, index) => (
                        <span key={index} className="category-tag">{cat}</span>
                      ))}
                      {incomeCategoriesState.length === 0 && <span className="no-categories-text">No income categories defined.</span>}
                    </div>
                  </div>

                  <div className="category-section-item">
                    <div className="category-header">
                      <label>Expense Categories</label>
                      <button type="button" onClick={() => setIsExpenseModalOpen(true)}>Manage</button>
                    </div>
                    <div className="category-tags-display">
                      {expenseCategoriesState.map((cat, index) => (
                        <span key={index} className="category-tag">{cat}</span>
                      ))}
                      {expenseCategoriesState.length === 0 && <span className="no-categories-text">No expense categories defined.</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && currentUser && currentUser.is_admin && (
              <div className="tab-content admin-tab-content">
                <h3>User Management</h3>
                {adminMessage && <div className="message">{adminMessage}</div>}
                {loadingUsers ? (
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
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No other users found.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button onClick={handleSave}>Save</button>
            <button onClick={onClose}>Cancel</button>
          </div>

        </div>

      </div>

      <CategoryEditorModal
          isOpen={isAssetModalOpen}
          onClose={() => setIsAssetModalOpen(false)}
          onSave={setAssetCategoriesState}
          categories={assetCategoriesState}
          title="Asset Categories"
      />
      <CategoryEditorModal
          isOpen={isLiabilityModalOpen}
          onClose={() => setIsLiabilityModalOpen(false)}
          onSave={setLiabilityCategoriesState}
          categories={liabilityCategoriesState}
          title="Liability Categories"
      />
      <CategoryEditorModal
          isOpen={isIncomeModalOpen}
          onClose={() => setIsIncomeModalOpen(false)}
          onSave={setIncomeCategoriesState}
          categories={incomeCategoriesState}
          title="Income Categories"
      />
      <CategoryEditorModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          onSave={setExpenseCategoriesState}
          categories={expenseCategoriesState}
          title="Expense Categories"
      />

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import SettingsService from '../services/settings.service';
import CategoryEditorModal from './CategoryEditorModal';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose, onSettingsSaved }) {
  const [inflationPercent, setInflationPercent] = useState(2.0);
  const [assetCategories, setAssetCategories] = useState([]);
  const [liabilityCategories, setLiabilityCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);

  // State for controlling the visibility of each category editor modal
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
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
  const [showChartTotals, setShowChartTotals] = useState(true); // New state for toggle

  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
    'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
    'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
    'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
    'WI', 'WY'
  ];
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('application'); // New state for tabs

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await SettingsService.getSettings();
      setInflationPercent(res.data.default_inflation_percent);
      // Correctly splitting comma-separated strings into arrays and handling null/empty
      setAssetCategories(res.data.asset_categories ? res.data.asset_categories.split(',') : []);
      setLiabilityCategories(res.data.liability_categories ? res.data.liability_categories.split(',') : []);
      setIncomeCategories(res.data.income_categories ? res.data.income_categories.split(',') : []);
      setExpenseCategories(res.data.expense_categories ? res.data.expense_categories.split(',') : []);
      setPerson1FirstName(res.data.person1_first_name || "");
      setPerson1LastName(res.data.person1_last_name || "");
      setPerson2FirstName(res.data.person2_first_name || "");
      setPerson2LastName(res.data.person2_last_name || "");
      setAddress(res.data.address || "");
      setCity(res.data.city || "");
      setState(res.data.state || "");
      setZipCode(res.data.zip_code || "");
      setEmail(res.data.email || "");
      setProjectionYears(res.data.projection_years || 30);
      setShowChartTotals(res.data.show_chart_totals ?? true); // Read new setting
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const handleSave = async () => {
    try {
      await SettingsService.updateSettings({
        default_inflation_percent: parseFloat(inflationPercent),
        asset_categories: assetCategories.join(','),
        liability_categories: liabilityCategories.join(','),
        income_categories: incomeCategories.join(','),
        expense_categories: expenseCategories.join(','),
        person1_first_name: person1FirstName,
        person1_last_name: person1LastName,
        person2_first_name: person2FirstName,
        person2_last_name: person2LastName,
        address: address,
        city: city,
        state: state,
        zip_code: zipCode,
        email: email,
        projection_years: parseInt(projectionYears),
        show_chart_totals: showChartTotals, // Save new setting
      });
      setMessage('Settings saved successfully!');
      // Call the provided callback to notify parent component of saved settings
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

  if (!isOpen) return null;

  return (
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
        </div>

        <div className="settings-form">
          {activeTab === 'application' && (
            <div className="tab-content">
              {/* Application Settings Section */}
              <h3>Application</h3>
              <div className="setting-group">
                {/* Default Inflation Rate (%) */}
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
                {/* Number of Years to Project */}
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
                {/* Show Chart Totals */}
                <div>
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
            <div className="tab-content">
              {/* Profile Section */}
              <h3>Profile</h3>
              <div className="setting-group">
                {/* First Name & Last Name */}
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
                {/* Spouse First Name & Spouse Last Name */}
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
                {/* Address */}
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
                {/* City */}
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
                {/* State */}
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
                {/* Zip Code */}
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
                {/* Email Address */}
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
                {/* Change Password Button */}
                <div>
                  <button type="button" className="change-password-btn">Change Password</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="tab-content">
              {/* Categories Section */}
              <h3>Categories</h3>
              <div className="setting-group">
                {/* Asset Categories & Liability Categories */}
                <div>
                  <label>Asset Categories</label>
                  <div className="category-display">
                    {assetCategories.map((cat, index) => (
                      <span key={index} className="category-tag">{cat}</span>
                    ))}
                    <button type="button" onClick={() => setIsAssetModalOpen(true)}>Manage</button>
                  </div>
                </div>
                <div>
                  <label>Liability Categories</label>
                  <div className="category-display">
                    {liabilityCategories.map((cat, index) => (
                      <span key={index} className="category-tag">{cat}</span>
                    ))}
                    <button type="button" onClick={() => setIsLiabilityModalOpen(true)}>Manage</button>
                  </div>
                </div>
                {/* Income Categories & Expense Categories */}
                <div>
                  <label>Income Categories</label>
                  <div className="category-display">
                    {incomeCategories.map((cat, index) => (
                      <span key={index} className="category-tag">{cat}</span>
                    ))}
                    <button type="button" onClick={() => setIsIncomeModalOpen(true)}>Manage</button>
                  </div>
                </div>
                <div>
                  <label>Expense Categories</label>
                  <div className="category-display">
                    {expenseCategories.map((cat, index) => (
                      <span key={index} className="category-tag">{cat}</span>
                    ))}
                    <button type="button" onClick={() => setIsExpenseModalOpen(true)}>Manage</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>

        {/* Category Editor Modals */}
        <CategoryEditorModal
          isOpen={isAssetModalOpen}
          onClose={() => setIsAssetModalOpen(false)}
          onSave={setAssetCategories}
          categories={assetCategories}
          title="Asset Categories"
        />
        <CategoryEditorModal
          isOpen={isLiabilityModalOpen}
          onClose={() => setIsLiabilityModalOpen(false)}
          onSave={setLiabilityCategories}
          categories={liabilityCategories}
          title="Liability Categories"
        />
        <CategoryEditorModal
          isOpen={isIncomeModalOpen}
          onClose={() => setIsIncomeModalOpen(false)}
          onSave={setIncomeCategories}
          categories={incomeCategories}
          title="Income Categories"
        />
        <CategoryEditorModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          onSave={setExpenseCategories}
          categories={expenseCategories}
          title="Expense Categories"
        />
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import SettingsService from '../services/settings.service';
import CategoryEditorModal from './CategoryEditorModal';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
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
  const [person1Name, setPerson1Name] = useState("");
  const [person2Name, setPerson2Name] = useState("");
  const [projectionYears, setProjectionYears] = useState(30);
  const [message, setMessage] = useState('');

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
      setPerson1Name(res.data.person1_name || "");
      setPerson2Name(res.data.person2_name || "");
      setProjectionYears(res.data.projection_years || 30);
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
        person1_name: person1Name,
        person2_name: person2Name,
        projection_years: parseInt(projectionYears),
      });
      setMessage('Settings saved successfully!');
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

        <div className="settings-form">
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

          {/* Asset Categories */}
          <label>Asset Categories</label>
          <div className="category-display">
            {assetCategories.map((cat, index) => (
              <span key={index} className="category-tag">{cat}</span>
            ))}
            <button type="button" onClick={() => setIsAssetModalOpen(true)}>Manage</button>
          </div>

          {/* Liability Categories */}
          <label>Liability Categories</label>
          <div className="category-display">
            {liabilityCategories.map((cat, index) => (
              <span key={index} className="category-tag">{cat}</span>
            ))}
            <button type="button" onClick={() => setIsLiabilityModalOpen(true)}>Manage</button>
          </div>

          {/* Income Categories */}
          <label>Income Categories</label>
          <div className="category-display">
            {incomeCategories.map((cat, index) => (
              <span key={index} className="category-tag">{cat}</span>
            ))}
            <button type="button" onClick={() => setIsIncomeModalOpen(true)}>Manage</button>
          </div>

          {/* Expense Categories */}
          <label>Expense Categories</label>
          <div className="category-display">
            {expenseCategories.map((cat, index) => (
              <span key={index} className="category-tag">{cat}</span>
            ))}
            <button type="button" onClick={() => setIsExpenseModalOpen(true)}>Manage</button>
          </div>

          <label htmlFor="person1-name">
            Person 1 Name
          </label>
          <input
            id="person1-name"
            type="text"
            value={person1Name}
            onChange={(e) => setPerson1Name(e.target.value)}
            placeholder="Person 1"
          />

          <label htmlFor="person2-name">
            Person 2 Name
          </label>
          <input
            id="person2-name"
            type="text"
            value={person2Name}
            onChange={(e) => setPerson2Name(e.target.value)}
            placeholder="Person 2"
          />

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
          onClose={() => setIsLiabilityModalOpen(false)}\
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
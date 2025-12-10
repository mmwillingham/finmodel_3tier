import React, { useState, useEffect } from 'react';
import SettingsService from '../services/settings.service';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [inflationPercent, setInflationPercent] = useState(2.0);
  const [assetCategories, setAssetCategories] = useState("");
  const [liabilityCategories, setLiabilityCategories] = useState("");
  const [incomeCategories, setIncomeCategories] = useState("");
  const [expenseCategories, setExpenseCategories] = useState("");
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
      setAssetCategories(res.data.asset_categories || "");
      setLiabilityCategories(res.data.liability_categories || "");
      setIncomeCategories(res.data.income_categories || "");
      setExpenseCategories(res.data.expense_categories || "");
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
        asset_categories: assetCategories,
        liability_categories: liabilityCategories,
        income_categories: incomeCategories,
        expense_categories: expenseCategories,
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
      setMessage('Error saving settings');
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

          <label htmlFor="asset-categories">
            Asset Categories (comma-separated)
          </label>
          <input
            id="asset-categories"
            type="text"
            value={assetCategories}
            onChange={(e) => setAssetCategories(e.target.value)}
            placeholder="Real Estate,Vehicles,Investments,Other"
          />

          <label htmlFor="liability-categories">
            Liability Categories (comma-separated)
          </label>
          <input
            id="liability-categories"
            type="text"
            value={liabilityCategories}
            onChange={(e) => setLiabilityCategories(e.target.value)}
            placeholder="Mortgage,Car Loan,Credit Card,Student Loan,Other"
          />

          <label htmlFor="income-categories">
            Income Categories (comma-separated)
          </label>
          <input
            id="income-categories"
            type="text"
            value={incomeCategories}
            onChange={(e) => setIncomeCategories(e.target.value)}
            placeholder="Salary,Bonus,Investment Income,Other"
          />

          <label htmlFor="expense-categories">
            Expense Categories (comma-separated)
          </label>
          <input
            id="expense-categories"
            type="text"
            value={expenseCategories}
            onChange={(e) => setExpenseCategories(e.target.value)}
            placeholder="Housing,Transportation,Food,Healthcare,Entertainment,Other"
          />

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
      </div>
    </div>
  );
}
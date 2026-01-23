import React, { useState, useEffect } from 'react';
import SettingsService from '../../services/settings.service';
import CategoryEditorModal from '../CategoryEditorModal';
import { useSettingsContext } from '../../context/SettingsContext.jsx';
import './Wizard.css';

  const CategoriesSetupWizard = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [assetCategories, setAssetCategories] = useState([]);
  const [liabilityCategories, setLiabilityCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const { refreshSettings } = useSettingsContext();

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const res = await SettingsService.getSettings();
      setAssetCategories(res.data.asset_categories || []);
      setLiabilityCategories(res.data.liability_categories || []);
      setIncomeCategories(res.data.income_categories || []);
      setExpenseCategories(res.data.expense_categories || []);
    } catch (e) {
      console.error('Failed to load categories', e);
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveCategories = async (categoryType, updatedCategories) => {
    setMessage('');
    try {
      const settingsToUpdate = {
        asset_categories: assetCategories,
        liability_categories: liabilityCategories,
        income_categories: incomeCategories,
        expense_categories: expenseCategories,
      };
      settingsToUpdate[`${categoryType}_categories`] = updatedCategories;

      await SettingsService.updateSettings(settingsToUpdate);
      await refreshSettings();
      setMessage(`${categoryType} categories saved!`);
      
      // Update local state
      if (categoryType === 'asset') setAssetCategories(updatedCategories);
      else if (categoryType === 'liability') setLiabilityCategories(updatedCategories);
      else if (categoryType === 'income') setIncomeCategories(updatedCategories);
      else if (categoryType === 'expense') setExpenseCategories(updatedCategories);
      
      setTimeout(() => setMessage(''), 1500);
    } catch (e) {
      console.error(`Failed to save ${categoryType} categories`, e);
      setMessage(e.response?.data?.detail || 'Error saving categories');
    }
  };

  const handleLoadDefaults = async () => {
    setMessage('');
    setLoading(true);
    try {
      await SettingsService.loadDefaultCategories();
      await refreshSettings();
      await loadCategories();
      setMessage('Default categories loaded successfully!');
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      console.error('Failed to load default categories', e);
      setMessage(e.response?.data?.detail || 'Error loading default categories');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) onComplete();
    onClose();
  };

  if (!isOpen) return null;

  const totalSteps = 5;
  const stepTitles = [
    "Asset Categories",
    "Liability Categories",
    "Income Categories",
    "Expense Categories",
    "Review & Complete"
  ];

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>Walk Me Through: Setup Categories</h2>
          <button className="wizard-close" onClick={onClose}>×</button>
        </div>

        <div className="wizard-progress">
          <div className="wizard-steps">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i + 1} className={`wizard-step ${currentStep >= i + 1 ? 'active' : ''}`}>
                <div className="wizard-step-number">{i + 1}</div>
                <div className="wizard-step-title">{stepTitles[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="wizard-content">
          {message && <div className={`wizard-message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}

          {currentStep === 1 && (
            <div className="wizard-step-content">
              <h3>Step 1: Asset Categories</h3>
              <p className="wizard-hint">Categories help you organize your assets (e.g., Checking, Savings, Investment).</p>
              <div className="wizard-category-section">
                <div className="category-display">
                  {assetCategories.length > 0 ? (
                    <div className="category-tags">
                      {assetCategories.map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-categories">No asset categories defined yet.</p>
                  )}
                </div>
                <button className="wizard-btn wizard-btn-secondary" onClick={() => setIsAssetModalOpen(true)}>
                  {assetCategories.length > 0 ? 'Edit Categories' : 'Add Categories'}
                </button>
                <button className="wizard-btn wizard-btn-link" onClick={handleLoadDefaults}>
                  Load Default Categories
                </button>
              </div>
              <CategoryEditorModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                onSave={(updatedCats) => handleSaveCategories('asset', updatedCats)}
                categories={assetCategories}
                title="Asset Categories"
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="wizard-step-content">
              <h3>Step 2: Liability Categories</h3>
              <p className="wizard-hint">Categories for your liabilities (e.g., Mortgage, Student Loan, Car Loan).</p>
              <div className="wizard-category-section">
                <div className="category-display">
                  {liabilityCategories.length > 0 ? (
                    <div className="category-tags">
                      {liabilityCategories.map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-categories">No liability categories defined yet.</p>
                  )}
                </div>
                <button className="wizard-btn wizard-btn-secondary" onClick={() => setIsLiabilityModalOpen(true)}>
                  {liabilityCategories.length > 0 ? 'Edit Categories' : 'Add Categories'}
                </button>
                <button className="wizard-btn wizard-btn-link" onClick={handleLoadDefaults}>
                  Load Default Categories
                </button>
              </div>
              <CategoryEditorModal
                isOpen={isLiabilityModalOpen}
                onClose={() => setIsLiabilityModalOpen(false)}
                onSave={(updatedCats) => handleSaveCategories('liability', updatedCats)}
                categories={liabilityCategories}
                title="Liability Categories"
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="wizard-step-content">
              <h3>Step 3: Income Categories</h3>
              <p className="wizard-hint">Categories for your income sources (e.g., Salary, Rental Income, Investments).</p>
              <div className="wizard-category-section">
                <div className="category-display">
                  {incomeCategories.length > 0 ? (
                    <div className="category-tags">
                      {incomeCategories.map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-categories">No income categories defined yet.</p>
                  )}
                </div>
                <button className="wizard-btn wizard-btn-secondary" onClick={() => setIsIncomeModalOpen(true)}>
                  {incomeCategories.length > 0 ? 'Edit Categories' : 'Add Categories'}
                </button>
                <button className="wizard-btn wizard-btn-link" onClick={handleLoadDefaults}>
                  Load Default Categories
                </button>
              </div>
              <CategoryEditorModal
                isOpen={isIncomeModalOpen}
                onClose={() => setIsIncomeModalOpen(false)}
                onSave={(updatedCats) => handleSaveCategories('income', updatedCats)}
                categories={incomeCategories}
                title="Income Categories"
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="wizard-step-content">
              <h3>Step 4: Expense Categories</h3>
              <p className="wizard-hint">Categories for your expenses (e.g., Housing, Food, Transportation).</p>
              <div className="wizard-category-section">
                <div className="category-display">
                  {expenseCategories.length > 0 ? (
                    <div className="category-tags">
                      {expenseCategories.map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-categories">No expense categories defined yet.</p>
                  )}
                </div>
                <button className="wizard-btn wizard-btn-secondary" onClick={() => setIsExpenseModalOpen(true)}>
                  {expenseCategories.length > 0 ? 'Edit Categories' : 'Add Categories'}
                </button>
                <button className="wizard-btn wizard-btn-link" onClick={handleLoadDefaults}>
                  Load Default Categories
                </button>
              </div>
              <CategoryEditorModal
                isOpen={isExpenseModalOpen}
                onClose={() => setIsExpenseModalOpen(false)}
                onSave={(updatedCats) => handleSaveCategories('expense', updatedCats)}
                categories={expenseCategories}
                title="Expense Categories"
              />
            </div>
          )}

          {currentStep === 5 && (
            <div className="wizard-step-content">
              <h3>Step 5: Review & Complete</h3>
              <div className="wizard-review">
                <div className="review-section">
                  <h4>Asset Categories ({assetCategories.length})</h4>
                  {assetCategories.length > 0 ? (
                    <div className="category-tags">
                      {assetCategories.map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-categories">None defined</p>
                  )}
                </div>
                <div className="review-section">
                  <h4>Liability Categories ({liabilityCategories.length})</h4>
                  {liabilityCategories.length > 0 ? (
                    <div className="category-tags">
                      {liabilityCategories.map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-categories">None defined</p>
                  )}
                </div>
                <div className="review-section">
                  <h4>Income Categories ({incomeCategories.length})</h4>
                  {incomeCategories.length > 0 ? (
                    <div className="category-tags">
                      {incomeCategories.map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-categories">None defined</p>
                  )}
                </div>
                <div className="review-section">
                  <h4>Expense Categories ({expenseCategories.length})</h4>
                  {expenseCategories.length > 0 ? (
                    <div className="category-tags">
                      {expenseCategories.map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-categories">None defined</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="wizard-actions">
          <button className="wizard-btn wizard-btn-secondary" onClick={handleBack} disabled={currentStep === 1}>
            Back
          </button>
          <button className="wizard-btn wizard-btn-primary" onClick={handleNext} disabled={loading}>
            {currentStep === totalSteps ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoriesSetupWizard;


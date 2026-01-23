import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsService from '../services/settings.service';
import { useAuth } from '../context/AuthContext';
import CategoryEditorModal from '../components/CategoryEditorModal';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages
import { useSettingsContext } from '../context/SettingsContext.jsx';

const CategorySettingsPage = () => {
  const { currentUser, viewingUserId } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [assetCategoriesState, setAssetCategoriesState] = useState([]);
  const [liabilityCategoriesState, setLiabilityCategoriesState] = useState([]);
  const [incomeCategoriesState, setIncomeCategoriesState] = useState([]);
  const [expenseCategoriesState, setExpenseCategoriesState] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { refreshSettings } = useSettingsContext();

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await SettingsService.getSettings(viewingUserId);
      setAssetCategoriesState(res.data.asset_categories || []);
      setLiabilityCategoriesState(res.data.liability_categories || []);
      setIncomeCategoriesState(res.data.income_categories || []);
      setExpenseCategoriesState(res.data.expense_categories || []);
    } catch (e) {
      console.error('Failed to load categories settings', e);
      setError('Failed to load categories settings.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveCategories = async (categoryType, updatedCategories) => {
    setMessage('');
    try {
        const settingsToUpdate = {
            asset_categories: assetCategoriesState,
            liability_categories: liabilityCategoriesState,
            income_categories: incomeCategoriesState,
            expense_categories: expenseCategoriesState,
        };
        // Update the specific category type
        settingsToUpdate[`${categoryType}_categories`] = updatedCategories;

        console.log(`Saving ${categoryType} categories:`, {
          old: categoryType === 'expense' ? expenseCategoriesState : 
               categoryType === 'income' ? incomeCategoriesState :
               categoryType === 'asset' ? assetCategoriesState : liabilityCategoriesState,
          new: updatedCategories
        });

        await SettingsService.updateSettings(settingsToUpdate);
        await refreshSettings();
        setMessage(`${categoryType} categories saved successfully! Categories in your items have been updated.`);
        // Refresh local state to reflect changes if save was successful
        loadSettings();
        // Trigger a custom event to notify other components to refresh their data
        window.dispatchEvent(new CustomEvent('categoriesUpdated', { detail: { categoryType } }));
        setTimeout(() => {
            setMessage('');
        }, 3000);
    } catch (e) {
        console.error(`Failed to save ${categoryType} categories`, e);
        const errorMessage = e.response?.data?.detail || 'Error saving categories';
        setMessage(errorMessage);
    }
};

  const handleLoadDefaultCategories = async () => {
    setMessage('');
    setLoadingDefaults(true);
    try {
      await SettingsService.loadDefaultCategories();
      await refreshSettings();
      setMessage('Default categories loaded successfully!');
      // Refresh local state to reflect changes
      loadSettings();
      setTimeout(() => {
        setMessage('');
      }, 2000);
    } catch (e) {
      console.error('Failed to load default categories', e);
      const errorMessage = e.response?.data?.detail || 'Error loading default categories';
      setMessage(errorMessage);
    } finally {
      setLoadingDefaults(false);
    }
  };

  if (loading) {
    return <div className="loading-message">Loading categories...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  const renderCategorySection = (title, categories, setIsModalOpen, categoryType) => (
    <div className="category-section-item">
        <div className="category-header">
            <label style={{ fontWeight: 700, fontSize: '1.1em', color: 'var(--color-heading)' }}>{title}</label>
            <button type="button" className="category-manage-button" onClick={() => setIsModalOpen(true)}>Manage</button>
        </div>
        <div className="category-tags-display">
            {categories.length > 0 ? (
                categories.map((cat, index) => (
                    <span key={index} className="category-tag">{cat}</span>
                ))
            ) : (
                <span className="no-categories-text">No {title.toLowerCase().replace(' categories', '')} defined.</span>
            )}
        </div>
        <CategoryEditorModal
            isOpen={(() => {
                switch(categoryType) {
                    case 'asset': return isAssetModalOpen;
                    case 'liability': return isLiabilityModalOpen;
                    case 'income': return isIncomeModalOpen;
                    case 'expense': return isExpenseModalOpen;
                    default: return false;
                }
            })()}
            onClose={() => {
                switch(categoryType) {
                    case 'asset': setIsAssetModalOpen(false); break;
                    case 'liability': setIsLiabilityModalOpen(false); break;
                    case 'income': setIsIncomeModalOpen(false); break;
                    case 'expense': setIsExpenseModalOpen(false); break;
                    default: break;
                }
            }}
            onSave={(updatedCats) => handleSaveCategories(categoryType, updatedCats)}
            categories={categories}
            title={title}
        />
    </div>
);

  return (
    <div className="settings-page-container">
      <h2>My Categories</h2>
      {message && <div className="message">{message}</div>}

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleLoadDefaultCategories} 
          className="save-button" 
          disabled={loadingDefaults}
          style={{ backgroundColor: '#17a2b8', borderColor: '#17a2b8' }}
        >
          {loadingDefaults ? 'Loading...' : 'Load Default Categories'}
        </button>
        <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
          Adds all default categories to your existing categories (duplicates will be skipped).
        </small>
      </div>

      <div className="setting-group category-settings-group">
        {renderCategorySection('Asset Categories', assetCategoriesState, setIsAssetModalOpen, 'asset')}
        {renderCategorySection('Liability Categories', liabilityCategoriesState, setIsLiabilityModalOpen, 'liability')}
        {renderCategorySection('Income Categories', incomeCategoriesState, setIsIncomeModalOpen, 'income')}
        {renderCategorySection('Expense Categories', expenseCategoriesState, setIsExpenseModalOpen, 'expense')}
      </div>
      <div className="settings-page-actions">
        <button onClick={() => navigate('/')} className="cancel-button">Cancel</button>
      </div>
    </div>
  );
};

export default CategorySettingsPage;

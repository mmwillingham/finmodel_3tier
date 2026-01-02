import React, { useState, useEffect, useCallback } from 'react';
import globalSettingsService from '../services/globalSettings.service';
import { useAuth } from '../context/AuthContext';
import CategoryEditorModal from './CategoryEditorModal'; // Import the CategoryEditorModal
import './GlobalSettings.css'; // Will update this CSS file

const GlobalSettings = ({ onGlobalSettingsSaved }) => { // Accept onGlobalSettingsSaved prop
    const { currentUser: user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(''); // For save/error messages

    // States to hold the global categories
    const [assetCategories, setAssetCategories] = useState([]);
    const [liabilityCategories, setLiabilityCategories] = useState([]);
    const [incomeCategories, setIncomeCategories] = useState([]);
    const [expenseCategories, setExpenseCategories] = useState([]);

    // States for controlling CategoryEditorModal visibility for global categories
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    const fetchGlobalSettings = useCallback(async () => {
        const currentToken = AuthService.getToken();
        if (!currentToken || !user || !user.is_admin) {
            console.error('GlobalSettings: Access Denied. User is not admin or token is missing.');
            setError('Access Denied: Only administrators can view global settings.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        console.log('GlobalSettings: Attempting to fetch global settings...');
        try {
            const data = await globalSettingsService.getGlobalSettings(currentToken);
            setAssetCategories(data.asset_categories || []);
            setLiabilityCategories(data.liability_categories || []);
            setIncomeCategories(data.income_categories || []);
            setExpenseCategories(data.expense_categories || []);
            setMessage('');
            console.log('GlobalSettings: Successfully fetched global settings:', data);
        } catch (err) {
            setError('Failed to fetch global settings.');
            console.error('GlobalSettings: Error fetching global settings:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchGlobalSettings();
    }, [fetchGlobalSettings]);

    // Generic save handler for CategoryEditorModal instances
    const handleSaveCategories = async (categoryType, updatedCategories) => {
        setLoading(true);
        setError(null);
        setMessage('');
        try {
            const settingsToUpdate = {
                asset_categories: assetCategories,
                liability_categories: liabilityCategories,
                income_categories: incomeCategories,
                expense_categories: expenseCategories,
            };
            // Update the specific category type
            settingsToUpdate[`${categoryType}_categories`] = updatedCategories;

            await globalSettingsService.updateGlobalSettings(settingsToUpdate, token);
            setMessage(`Global ${categoryType} categories saved successfully!`);
            // Re-fetch global settings to ensure UI is in sync with backend after save
            await fetchGlobalSettings();
            // Trigger a refresh of the *user's* settings in AuthContext
            if (onGlobalSettingsSaved) {
                onGlobalSettingsSaved();
            }
        } catch (err) {
            setError(`Failed to update global ${categoryType} categories.`);
            console.error(`Error updating global ${categoryType} categories:`, err);
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000); // Clear message after 3 seconds
        }
    };

    if (loading) {
        return <div className="loading-message">Loading global settings...</div>;
    }

    if (error) {
        return <div className="error-message">Error: {error}</div>;
    }

    if (!user || !user.is_admin) {
        return <div className="access-denied-message">Access Denied: You must be an administrator to view this page.</div>;
    }

    // Helper to render a category display section
    const renderCategoryDisplay = (type, categories, setIsModalOpen) => (
        <div className="global-category-section">
            <h4>{type} Categories</h4>
            <button type="button" className="global-manage-button" onClick={() => {
                setIsModalOpen(true);
            }}>Manage</button>
            <div className="category-tags-display">
                {categories.length > 0 ? (
                    categories.map((cat, index) => (
                        <span key={index} className="category-tag">{cat}</span>
                    ))
                ) : (
                    <span className="no-categories-text">No {type.toLowerCase()} categories defined globally.</span>
                )}
            </div>
        </div>
    );

    return (
        <div className="global-settings-container">
            <h2>Global Default Categories</h2>
            {message && <div className="success-message">{message}</div>}

            <div className="global-categories-grid">
                {renderCategoryDisplay('Asset', assetCategories, setIsAssetModalOpen)}
                {renderCategoryDisplay('Liability', liabilityCategories, setIsLiabilityModalOpen)}
                {renderCategoryDisplay('Income', incomeCategories, setIsIncomeModalOpen)}
                {renderCategoryDisplay('Expense', expenseCategories, setIsExpenseModalOpen)}
            </div>

            {/* Category Editor Modals for Global Categories */}
            <CategoryEditorModal
                isOpen={isAssetModalOpen}
                onClose={() => {
                    setIsAssetModalOpen(false);
                }}
                onSave={(updatedCats) => handleSaveCategories('asset', updatedCats)}
                categories={assetCategories}
                title="Global Asset Categories"
            />
            <CategoryEditorModal
                isOpen={isLiabilityModalOpen}
                onClose={() => {
                    setIsLiabilityModalOpen(false);
                }}
                onSave={(updatedCats) => handleSaveCategories('liability', updatedCats)}
                categories={liabilityCategories}
                title="Global Liability Categories"
            />
            <CategoryEditorModal
                isOpen={isIncomeModalOpen}
                onClose={() => {
                    setIsIncomeModalOpen(false);
                }}
                onSave={(updatedCats) => handleSaveCategories('income', updatedCats)}
                categories={incomeCategories}
                title="Global Income Categories"
            />
            <CategoryEditorModal
                isOpen={isExpenseModalOpen}
                onClose={() => {
                    setIsExpenseModalOpen(false);
                }}
                onSave={(updatedCats) => handleSaveCategories('expense', updatedCats)}
                categories={expenseCategories}
                title="Global Expense Categories"
            />
        </div>
    );
};

export default GlobalSettings;

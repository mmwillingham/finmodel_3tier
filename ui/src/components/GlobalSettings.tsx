import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@mui/material";
import globalSettingsService from '../services/globalSettings.service';
import { useAuth } from '../context/AuthContext';
import CategoryEditorModal from './CategoryEditorModal'; // Import the CategoryEditorModal
import AuthService from '../services/auth.service';
import { projectionActionButtonSx } from "../utils/projectionUiStyles";

interface GlobalSettingsProps {
    onGlobalSettingsSaved?: () => void;
}

interface SettingsResponse {
    asset_categories?: string[];
    liability_categories?: string[];
    income_categories?: string[];
    expense_categories?: string[];
    free_max_projection_years?: number;
    free_max_documents?: number;
    free_max_whatif_monthly?: number;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onGlobalSettingsSaved }) => {
    const { currentUser: user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState(''); // For save/error messages

    // States to hold the global categories
    const [assetCategories, setAssetCategories] = useState<string[]>([]);
    const [liabilityCategories, setLiabilityCategories] = useState<string[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
    const [freeMaxProjectionYears, setFreeMaxProjectionYears] = useState<number>(5);
    const [freeMaxDocuments, setFreeMaxDocuments] = useState<number>(5);
    const [freeMaxWhatIfMonthly, setFreeMaxWhatIfMonthly] = useState<number>(5);

    // States for controlling CategoryEditorModal visibility for global categories
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    const fetchGlobalSettings = useCallback(async () => {
        const currentToken = AuthService.getToken();
        if (!currentToken || !user || !user.is_admin) {
            setError('Access Denied: Only administrators can view global settings.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data: SettingsResponse = await globalSettingsService.getGlobalSettings(currentToken);
            setAssetCategories(data.asset_categories || []);
            setLiabilityCategories(data.liability_categories || []);
            setIncomeCategories(data.income_categories || []);
            setExpenseCategories(data.expense_categories || []);
            setFreeMaxProjectionYears(data.free_max_projection_years ?? 5);
            setFreeMaxDocuments(data.free_max_documents ?? 5);
            setFreeMaxWhatIfMonthly(data.free_max_whatif_monthly ?? 5);
            setMessage('');
        } catch (err: any) {
            setError('Failed to fetch global settings.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchGlobalSettings();
    }, [fetchGlobalSettings]);

    // Generic save handler for CategoryEditorModal instances
    const handleSaveCategories = async (categoryType: any, updatedCategories: any) => {
        const currentToken = AuthService.getToken();
        if (!currentToken) {
            setError('Authentication token missing. Please log in again.');
            setLoading(false);
            return;
        }
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
            (settingsToUpdate as any)[`${categoryType}_categories`] = updatedCategories;

            await globalSettingsService.updateGlobalSettings(settingsToUpdate, currentToken);
            setMessage(`Global ${categoryType} categories saved successfully!`);
            // Re-fetch global settings to ensure UI is in sync with backend after save
            await fetchGlobalSettings();
            // Trigger a refresh of the *user's* settings in AuthContext
            if (onGlobalSettingsSaved) {
                onGlobalSettingsSaved();
            }
        } catch (err: any) {
            setError(`Failed to update global ${categoryType} categories.`);
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000); // Clear message after 3 seconds
        }
    };

    const handleSaveLimits = async () => {
        const currentToken = AuthService.getToken();
        if (!currentToken) {
            setError('Authentication token missing. Please log in again.');
            return;
        }
        setLoading(true);
        setError(null);
        setMessage('');
        try {
            await globalSettingsService.updateGlobalSettings({
                free_max_projection_years: freeMaxProjectionYears,
                free_max_documents: freeMaxDocuments,
                free_max_whatif_monthly: freeMaxWhatIfMonthly,
            }, currentToken);
            setMessage('Free tier limits updated successfully!');
            await fetchGlobalSettings();
        } catch (err: any) {
            setError('Failed to update free tier limits.');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
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

    // Helper to render a category display section (matching CategorySettingsPage structure)
    const renderCategoryDisplay = (type: any, categories: any, setIsModalOpen: any) => (
        <div className="category-section-item">
            <div className="category-header">
                <label style={{ fontWeight: 700, fontSize: '1.1em', color: 'var(--color-heading)' }}>{type} Categories</label>
                <Button type="button" variant="contained" sx={projectionActionButtonSx} onClick={() => {
                    setIsModalOpen(true);
                }}>Manage</Button>
            </div>
            <div className="category-tags-display">
                {categories.length > 0 ? (
                    categories.map((cat: any, index: any) => (
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

            <div className="setting-group category-settings-group">
                {renderCategoryDisplay('Asset', assetCategories, setIsAssetModalOpen)}
                {renderCategoryDisplay('Liability', liabilityCategories, setIsLiabilityModalOpen)}
                {renderCategoryDisplay('Income', incomeCategories, setIsIncomeModalOpen)}
                {renderCategoryDisplay('Expense', expenseCategories, setIsExpenseModalOpen)}
            </div>

            <div className="setting-group" style={{ marginTop: '20px' }}>
                <div className="category-section-item" style={{ width: '100%' }}>
                    <div className="category-header">
                        <label style={{ fontWeight: 700, fontSize: '1.1em', color: 'var(--color-heading)' }}>Free Tier Limits</label>
                    </div>
                    <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                        <div className="form-field">
                            <label htmlFor="free-max-projection-years">Max Projection Years</label>
                            <input
                                id="free-max-projection-years"
                                name="free-max-projection-years"
                                autoComplete="off"
                                type="number"
                                min="0"
                                value={freeMaxProjectionYears}
                                onChange={(e: any) => setFreeMaxProjectionYears(Number(e.target.value))}
                            />
                        </div>
                        <div className="form-field">
                            <label htmlFor="free-max-documents">Max Documents</label>
                            <input
                                id="free-max-documents"
                                name="free-max-documents"
                                autoComplete="off"
                                type="number"
                                min="0"
                                value={freeMaxDocuments}
                                onChange={(e: any) => setFreeMaxDocuments(Number(e.target.value))}
                            />
                        </div>
                        <div className="form-field">
                            <label htmlFor="free-max-whatif">Max What If Requests / Month</label>
                            <input
                                id="free-max-whatif"
                                name="free-max-whatif"
                                autoComplete="off"
                                type="number"
                                min="0"
                                value={freeMaxWhatIfMonthly}
                                onChange={(e: any) => setFreeMaxWhatIfMonthly(Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                        <Button type="button" variant="contained" sx={projectionActionButtonSx} onClick={handleSaveLimits}>
                            Save Limits
                        </Button>
                    </div>
                </div>
            </div>

            {/* Category Editor Modals for Global Categories */}
            <CategoryEditorModal
                isOpen={isAssetModalOpen}
                onClose={() => {
                    setIsAssetModalOpen(false);
                }}
                onSave={(updatedCats: any) => handleSaveCategories('asset', updatedCats)}
                categories={assetCategories}
                title="Global Asset Categories"
            />
            <CategoryEditorModal
                isOpen={isLiabilityModalOpen}
                onClose={() => {
                    setIsLiabilityModalOpen(false);
                }}
                onSave={(updatedCats: any) => handleSaveCategories('liability', updatedCats)}
                categories={liabilityCategories}
                title="Global Liability Categories"
            />
            <CategoryEditorModal
                isOpen={isIncomeModalOpen}
                onClose={() => {
                    setIsIncomeModalOpen(false);
                }}
                onSave={(updatedCats: any) => handleSaveCategories('income', updatedCats)}
                categories={incomeCategories}
                title="Global Income Categories"
            />
            <CategoryEditorModal
                isOpen={isExpenseModalOpen}
                onClose={() => {
                    setIsExpenseModalOpen(false);
                }}
                onSave={(updatedCats: any) => handleSaveCategories('expense', updatedCats)}
                categories={expenseCategories}
                title="Global Expense Categories"
            />
        </div>
    );
};

export default GlobalSettings;

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { projectionActionButtonSx, projectionSecondaryButtonSx } from "../utils/projectionUiStyles";
import SettingsService from '../services/settings.service';
import { useAuth } from '../context/AuthContext';
import CategoryEditorModal from '../components/CategoryEditorModal';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages
import { useSettingsContext } from '../context/SettingsContext';

const CategorySettingsPage = () => {
  const { currentUser, viewingUserId } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [assetCategoriesState, setAssetCategoriesState] = useState<any[]>([]);
  const [liabilityCategoriesState, setLiabilityCategoriesState] = useState<any[]>([]);
  const [incomeCategoriesState, setIncomeCategoriesState] = useState<any[]>([]);
  const [expenseCategoriesState, setExpenseCategoriesState] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const { refreshSettings } = useSettingsContext();
  const isViewingOther = viewingUserId && viewingUserId !== currentUser?.id;

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
    } catch (e: any) {
      setError('Failed to load categories settings.');
    } finally {
      setLoading(false);
    }
  }, [viewingUserId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveCategories = async (categoryType: any, updatedCategories: any) => {
    if (isViewingOther) {
      setMessage('Categories are read-only when viewing another account.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setMessage('');
    try {
        const settingsToUpdate = {
            asset_categories: assetCategoriesState,
            liability_categories: liabilityCategoriesState,
            income_categories: incomeCategoriesState,
            expense_categories: expenseCategoriesState,
        };
        // Update the specific category type
        (settingsToUpdate as any)[`${categoryType}_categories`] = updatedCategories;

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
    } catch (e: any) {
        const errorMessage = e.response?.data?.detail || 'Error saving categories';
        setMessage(errorMessage);
    }
};

  const handleLoadDefaultCategories = async () => {
    setMessage('');
    setLoadingDefaults(true);
    try {
      if (isViewingOther) {
        setMessage('Categories are read-only when viewing another account.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      await SettingsService.loadDefaultCategories();
      await refreshSettings();
      setMessage('Default categories loaded successfully!');
      // Refresh local state to reflect changes
      loadSettings();
      setTimeout(() => {
        setMessage('');
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.response?.data?.detail || 'Error loading default categories';
      setMessage(errorMessage);
    } finally {
      setLoadingDefaults(false);
    }
  };

  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={18} />
        <Typography variant="body2">Loading categories...</Typography>
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">Error: {error}</Alert>;
  }

  const renderCategorySection = (title: any, categories: any, setIsModalOpen: any, categoryType: any) => (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
            <Typography variant="subtitle1" fontWeight="700">{title}</Typography>
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={() => !isViewingOther && setIsModalOpen(true)}
              disabled={Boolean(isViewingOther)}
              sx={{ textTransform: "none" }}
            >
              Manage
            </Button>
        </Stack>
        <Box className="category-tags-display">
            {categories.length > 0 ? (
                categories.map((cat: any, index: any) => (
                    <span key={index} className="category-tag">{cat}</span>
                ))
            ) : (
                <Typography variant="body2" color="text.secondary">No {title.toLowerCase().replace(' categories', '')} defined.</Typography>
            )}
        </Box>
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
            onSave={(updatedCats: any) => handleSaveCategories(categoryType, updatedCats)}
            categories={categories}
            title={title}
        />
    </Paper>
);

  return (
    <Box>
      <Typography variant="h5" fontWeight="600" sx={{ mb: 2 }}>My Categories</Typography>
      {isViewingOther && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You are viewing another account. Categories are shown for reference only and cannot be modified.
        </Alert>
      )}
      {message && <Alert severity={message.toLowerCase().includes('error') ? "error" : "success"} sx={{ mb: 2 }}>{message}</Alert>}

      <Box sx={{ mb: 2 }}>
        <Button 
          onClick={handleLoadDefaultCategories} 
          variant="contained"
          disabled={loadingDefaults}
          sx={projectionActionButtonSx}
        >
          {loadingDefaults ? 'Loading...' : 'Load Default Categories'}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Adds all default categories to your existing categories (duplicates will be skipped).
        </Typography>
      </Box>

      <Stack spacing={2}>
        {renderCategorySection('Asset Categories', assetCategoriesState, setIsAssetModalOpen, 'asset')}
        {renderCategorySection('Liability Categories', liabilityCategoriesState, setIsLiabilityModalOpen, 'liability')}
        {renderCategorySection('Income Categories', incomeCategoriesState, setIsIncomeModalOpen, 'income')}
        {renderCategorySection('Expense Categories', expenseCategoriesState, setIsExpenseModalOpen, 'expense')}
      </Stack>
      <Stack direction="row" sx={{ mt: 2 }}>
        <Button onClick={() => navigate('/app')} variant="outlined" sx={projectionSecondaryButtonSx}>Close</Button>
      </Stack>
    </Box>
  );
};

export default CategorySettingsPage;

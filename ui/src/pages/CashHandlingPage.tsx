import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Paper, Stack, Switch, Typography } from "@mui/material";
import { projectionActionButtonSx, projectionCheckboxSx, projectionSwitchSx } from "../utils/projectionUiStyles";
import SettingsService from '../services/settings.service';
import AssetService from '../services/asset.service';
import CashFlowService from '../services/cashflow.service';
import { useAuth } from '../context/AuthContext';
import { useSettingsContext } from '../context/SettingsContext';
import './SettingsPages.css';

const CashHandlingPage = () => {
  const { viewingUserId } = useAuth();
  const [cashAssetIds, setCashAssetIds] = useState<any[]>([]);
  const [cashInSourceIds, setCashInSourceIds] = useState<any[]>([]);
  const [cashOutSourceIds, setCashOutSourceIds] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [incomeItems, setIncomeItems] = useState<any[]>([]);
  const [expenseItems, setExpenseItems] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [showEnabledCashInOnly, setShowEnabledCashInOnly] = useState(false);
  const [showEnabledCashOutOnly, setShowEnabledCashOutOnly] = useState(false);
  const { refreshSettings } = useSettingsContext();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, assetsRes, incomeRes, expenseRes] = await Promise.all([
        SettingsService.getSettings(viewingUserId),
        AssetService.list(viewingUserId || null).catch((): any => ({ data: [] as any[] })),
        CashFlowService.list(true, viewingUserId).catch((): any => ({ data: [] as any[] })),
        CashFlowService.list(false, viewingUserId).catch((): any => ({ data: [] as any[] }))
      ]);
      setCashAssetIds(settingsRes.data.cash_asset_ids || []);
      setCashInSourceIds(settingsRes.data.cash_in_source_ids || []);
      setCashOutSourceIds(settingsRes.data.cash_out_source_ids || []);
      setAssets(assetsRes.data || []);
      setIncomeItems(incomeRes.data || []);
      setExpenseItems(expenseRes.data || []);
    } catch (e: any) {
      setError('Failed to load cash handling settings.');
    } finally {
      setLoading(false);
    }
  }, [viewingUserId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    try {
      setMessage('');
      setError(null);
      await SettingsService.updateSettings({
        cash_asset_ids: cashAssetIds,
        cash_in_source_ids: cashInSourceIds,
        cash_out_source_ids: cashOutSourceIds,
      });
      await refreshSettings();
      setMessage('Cash handling settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      setError('Failed to save cash handling settings: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleCashAssetToggle = (assetId: any) => {
    setCashAssetIds((prev: any) => {
      if (prev.includes(assetId)) {
        return prev.filter((id: any) => id !== assetId);
      } else {
        return [...prev, assetId];
      }
    });
  };

  const handleCashInSourceToggle = (itemId: any) => {
    setCashInSourceIds((prev: any) => {
      if (prev.length === 0) {
        // If none selected (default to all), select all except this one
        const allIds = incomeItems.map((item: any) => item.id);
        return allIds.filter((id: any) => id !== itemId);
      } else if (prev.includes(itemId)) {
        return prev.filter((id: any) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleCashOutSourceToggle = (itemId: any) => {
    setCashOutSourceIds((prev: any) => {
      if (prev.length === 0) {
        // If none selected (default to all), select all except this one
        const allIds = expenseItems.map((item: any) => item.id);
        return allIds.filter((id: any) => id !== itemId);
      } else if (prev.includes(itemId)) {
        return prev.filter((id: any) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleSelectIndividualIncomeItemsToggle = (enabled: any) => {
    setShowEnabledCashInOnly(enabled);
    if (!enabled) {
      // Reset to default behavior: none selected means "include all"
      setCashInSourceIds([]);
    }
  };

  const handleSelectIndividualExpensesToggle = (enabled: any) => {
    setShowEnabledCashOutOnly(enabled);
    if (!enabled) {
      // Reset to default behavior: none selected means "include all"
      setCashOutSourceIds([]);
    }
  };

  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={18} />
        <Typography variant="body2">Loading cash handling settings...</Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight="600" sx={{ mb: 1 }}>
        Cash Handling
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Configure which assets and income/expense items are used for cash-flow calculations.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      <Stack spacing={2.5}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1 }}>
            Cash Assets (for Cash Flow Diagrams)
          </Typography>
          <Box sx={{ maxHeight: "50vh", overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            {assets.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No assets found. Add assets first.</Typography>
            ) : (
              <Stack spacing={0.5}>
                {assets.map((asset: any) => (
                  <FormControlLabel
                    key={asset.id}
                    control={<Checkbox sx={projectionCheckboxSx} checked={cashAssetIds.includes(asset.id)} onChange={() => handleCashAssetToggle(asset.id)} />}
                    label={`${asset.name} (${asset.category})`}
                  />
                ))}
              </Stack>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Select assets that should be considered cash for diagram visualizations.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="600">
            Cash-In Sources (for Cash Flow Diagrams)
            </Typography>
            <FormControlLabel
              control={<Switch sx={projectionSwitchSx} checked={showEnabledCashInOnly} onChange={(e: any) => handleSelectIndividualIncomeItemsToggle(e.target.checked)} />}
              label="Select individual Income Items"
            />
          </Stack>
          <Box sx={{ maxHeight: "50vh", overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            {!showEnabledCashInOnly ? (
              <Typography variant="body2" color="text.secondary">
                Enable "Select individual Income Items" to choose specific income sources. When disabled, all income items are included.
              </Typography>
            ) : incomeItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No income items found. Add income items first.</Typography>
            ) : (
              <Stack spacing={0.5}>
                {incomeItems
                  .map((item: any) => {
                  const isChecked = cashInSourceIds.length === 0 || cashInSourceIds.includes(item.id);
                  return (
                    <FormControlLabel
                      key={item.id}
                      control={<Checkbox sx={projectionCheckboxSx} checked={isChecked} onChange={() => handleCashInSourceToggle(item.id)} />}
                      label={`${item.description || item.name} (${item.category})`}
                    />
                  );
                  })}
              </Stack>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            If none are selected, all income items are included.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="600">
            Cash-Out Destinations (for Cash Flow Diagrams)
            </Typography>
            <FormControlLabel
              control={<Switch sx={projectionSwitchSx} checked={showEnabledCashOutOnly} onChange={(e: any) => handleSelectIndividualExpensesToggle(e.target.checked)} />}
              label="Select Individual Expenses"
            />
          </Stack>
          <Box sx={{ maxHeight: "50vh", overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            {!showEnabledCashOutOnly ? (
              <Typography variant="body2" color="text.secondary">
                Enable "Select Individual Expenses" to choose specific expense sources. When disabled, all expense items are included.
              </Typography>
            ) : expenseItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No expense items found. Add expense items first.</Typography>
            ) : (
              <Stack spacing={0.5}>
                {expenseItems
                  .map((item: any) => {
                  const isChecked = cashOutSourceIds.length === 0 || cashOutSourceIds.includes(item.id);
                  return (
                    <FormControlLabel
                      key={item.id}
                      control={<Checkbox sx={projectionCheckboxSx} checked={isChecked} onChange={() => handleCashOutSourceToggle(item.id)} />}
                      label={`${item.description || item.name} (${item.category})`}
                    />
                  );
                  })}
              </Stack>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            If none are selected, all expense items are included.
          </Typography>
        </Paper>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={handleSave} variant="contained" sx={projectionActionButtonSx}>
            Save Changes
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default CashHandlingPage;

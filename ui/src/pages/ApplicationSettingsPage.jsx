import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { projectionActionButtonSx, projectionSecondaryButtonSx } from "../utils/projectionUiStyles";
import SettingsService from '../services/settings.service';
import { useSettingsContext } from '../context/SettingsContext.jsx';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import './SettingsPages.css'; // General CSS for settings pages

const ApplicationSettingsPage = () => {
  const navigate = useNavigate();
  useSettingsBackButton(); // Fix browser back button navigation
  const [inflationPercent, setInflationPercent] = useState(2.0);
  const [projectionYears, setProjectionYears] = useState(20);
  const [showChartTotals, setShowChartTotals] = useState(true);
  const { settings, loading: settingsLoading, refreshSettings } = useSettingsContext();
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setInflationPercent(settings.default_inflation_percent || 2.0);
    setProjectionYears(settings.projection_years || 20);
    setShowChartTotals(settings.show_chart_totals ?? true);
  }, [settings]);

  const handleSave = async () => {
    setMessage('');
    setError(null);
    try {
      await SettingsService.updateSettings({
        default_inflation_percent: parseFloat(inflationPercent),
        projection_years: parseInt(projectionYears),
        show_chart_totals: showChartTotals,
      });
      await refreshSettings();
      navigate('/app');
    } catch (e) {
      const errorMessage = e.response?.data?.detail || 'Error saving settings';
      setMessage(errorMessage);
    }
  };


  if (settingsLoading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
        <CircularProgress size={18} />
        <Typography variant="body2">Loading application settings...</Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight="600" sx={{ mb: 2 }}>
        Application Settings
      </Typography>
      {message && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Stack spacing={2.5} sx={{ maxWidth: 520 }}>
        <TextField
          id="default-inflation"
          label="Inflation Rate Percentage (Default)"
          type="number"
          size="small"
          inputProps={{ step: 0.1 }}
          value={inflationPercent}
          onChange={(e) => setInflationPercent(e.target.value)}
        />

        <TextField
          id="projection-years"
          label="Projection Years (Default)"
          type="number"
          size="small"
          value={projectionYears}
          onChange={(e) => setProjectionYears(e.target.value)}
          placeholder="20"
        />

        <FormControlLabel
          control={
            <Switch
              id="show-chart-totals"
              checked={showChartTotals}
              onChange={(e) => setShowChartTotals(e.target.checked)}
            />
          }
          label="Show Chart Totals (Default)"
        />

        <Stack direction="row" spacing={1.5}>
          <Button onClick={handleSave} variant="contained" sx={projectionActionButtonSx}>
            Save
          </Button>
          <Button onClick={() => navigate('/app')} variant="outlined" sx={projectionSecondaryButtonSx}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default ApplicationSettingsPage;

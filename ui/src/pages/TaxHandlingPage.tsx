import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { projectionActionButtonSx, projectionSecondaryButtonSx } from "../utils/projectionUiStyles";
import SettingsService from "../services/settings.service";
import { useSettingsContext } from "../context/SettingsContext";
import { useSettingsBackButton } from "../hooks/useSettingsBackButton";
import "./SettingsPages.css";

const TaxHandlingPage = () => {
  const navigate = useNavigate();
  useSettingsBackButton();
  const {
    settings,
    loading: settingsLoading,
    refreshSettings,
  } = useSettingsContext();
  const [taxYear, setTaxYear] = useState(2025);
  const [calculateFederalTax, setCalculateFederalTax] = useState(false);
  const [calculateStateTax, setCalculateStateTax] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!settings) return;
    const typedSettings = settings as any;
    setTaxYear(Number(typedSettings.tax_year || 2025));
    setCalculateFederalTax(Boolean(typedSettings.calculate_federal_tax ?? false));
    setCalculateStateTax(Boolean(typedSettings.calculate_state_tax ?? false));
  }, [settings]);

  const handleSave = async () => {
    setMessage("");
    try {
      await SettingsService.updateSettings({
        tax_year: Number(taxYear),
        calculate_federal_tax: calculateFederalTax,
        calculate_state_tax: calculateStateTax,
      });
      await refreshSettings();
      setMessage("Tax settings saved.");
      setTimeout(() => {
        setMessage("");
        navigate("/app");
      }, 800);
    } catch (e: any) {
      setMessage(e.response?.data?.detail || "Error saving tax settings");
    }
  };

  if (settingsLoading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={18} />
        <Typography variant="body2">Loading tax settings...</Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight="600" sx={{ mb: 2 }}>
        Tax Handling
      </Typography>
      {message && (
        <Alert severity={message.toLowerCase().includes("error") ? "error" : "success"} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
        <TextField
          id="tax-year"
          label="Tax Year"
          type="number"
          size="small"
          inputProps={{ min: 2020, max: 2100 }}
          value={taxYear}
          onChange={(e: any) => setTaxYear(Number(e.target.value))}
        />

        <FormControlLabel
          control={
            <Switch
              id="calculate-federal-tax"
              checked={calculateFederalTax}
              onChange={(e: any) => setCalculateFederalTax(e.target.checked)}
            />
          }
          label="Calculate Federal Income Tax"
        />
        {calculateFederalTax && (
          <Alert severity="warning" variant="outlined">
            <strong>Note:</strong> This creates a "Federal Income Tax (Calculated)" expense item. Tax filing status and Person 1 birthdate must be set in Profile Settings.
          </Alert>
        )}

        <FormControlLabel
          control={
            <Switch
              id="calculate-state-tax"
              checked={calculateStateTax}
              onChange={(e: any) => setCalculateStateTax(e.target.checked)}
            />
          }
          label="Calculate State Income Tax"
        />
        {calculateStateTax && (
          <Alert severity="warning" variant="outlined">
            <strong>Note:</strong> This creates a "State Income Tax (Calculated)" expense item. Set your state in Profile Settings for accurate calculations.
          </Alert>
        )}

        <Stack direction="row" spacing={1.5}>
          <Button onClick={handleSave} variant="contained" sx={projectionActionButtonSx}>
            Save
          </Button>
          <Button onClick={() => navigate("/app")} variant="outlined" sx={projectionSecondaryButtonSx}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default TaxHandlingPage;

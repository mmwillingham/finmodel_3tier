import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Checkbox, FormControlLabel } from "@mui/material";
import { useAuth } from '../context/AuthContext';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import ExportImportService from '../services/exportImport.service';
import { projectionActionButtonSx, projectionSecondaryButtonSx } from "../utils/projectionUiStyles";
import './SettingsPages.css';

const ExportImportPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton();
  
  const [exportOptions, setExportOptions] = useState({
    include_accounts: true,
    include_assets: true,
    include_liabilities: true,
    include_income: true,
    include_expenses: true,
    include_projections: true,
    include_charts: true,
  });

  const [exportFormat, setExportFormat] = useState('json'); // 'json' or 'csv'
  const [exportFilename, setExportFilename] = useState('');

  const [importFile, setImportFile] = useState(null);
  const [importOptions, setImportOptions] = useState({
    include_accounts: true,
    include_assets: true,
    include_liabilities: true,
    include_income: true,
    include_expenses: true,
    include_projections: true,
    include_charts: true,
  });

  const [exportMessage, setExportMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setExportMessage('');
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const defaultFilename = exportFilename || `financial_data_export_${dateStr}.${exportFormat}`;
      await ExportImportService.exportData(exportOptions, exportFormat, defaultFilename);
      setExportMessage(`Data exported successfully as ${exportFormat.toUpperCase()}! Check your downloads folder.`);
      setTimeout(() => setExportMessage(''), 3000);
    } catch (error) {
      setExportMessage('Error exporting data. Please try again.');
      setTimeout(() => setExportMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
      setImportFile(file);
    } else {
      setImportMessage('Please select a valid JSON file.');
      setTimeout(() => setImportMessage(''), 3000);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setImportMessage('Please select a file to import.');
      setTimeout(() => setImportMessage(''), 3000);
      return;
    }

    setLoading(true);
    setImportMessage('');
    setImportResult(null);

    try {
      const fileContent = await importFile.text();
      const importData = JSON.parse(fileContent);

      // Filter the data based on import options
      const filteredData = {
        data: {}
      };

      if (importOptions.include_accounts && importData.data?.accounts) {
        filteredData.data.accounts = importData.data.accounts;
      }
      if (importOptions.include_assets && importData.data?.assets) {
        filteredData.data.assets = importData.data.assets;
      }
      if (importOptions.include_liabilities && importData.data?.liabilities) {
        filteredData.data.liabilities = importData.data.liabilities;
      }
      if (importOptions.include_income && importData.data?.income) {
        filteredData.data.income = importData.data.income;
      }
      if (importOptions.include_expenses && importData.data?.expenses) {
        filteredData.data.expenses = importData.data.expenses;
      }
      if (importOptions.include_projections && importData.data?.projections) {
        filteredData.data.projections = importData.data.projections;
      }
      if (importOptions.include_charts && importData.data?.charts) {
        filteredData.data.charts = importData.data.charts;
      }

      const result = await ExportImportService.importData(filteredData);
      setImportResult(result);
      setImportMessage(`Import completed! ${result.accounts || 0} accounts, ${result.assets || 0} assets, ${result.liabilities || 0} liabilities, ${result.income || 0} income items, ${result.expenses || 0} expense items imported.`);
      
      if (result.errors && result.errors.length > 0) {
        setImportMessage(prev => prev + ` ${result.errors.length} error(s) occurred.`);
      }
      
      setTimeout(() => {
        setImportMessage('');
        setImportResult(null);
      }, 10000);
    } catch (error) {
      setImportMessage('Error importing data. Please check the file format and try again.');
      setTimeout(() => setImportMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const toggleExportOption = (option) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const toggleImportOption = (option) => {
    setImportOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  return (
    <div className="settings-page-container export-import-page">
      <h2>Export / Import Data</h2>

      {/* Export Section */}
      <div className="export-import-section">
        <div className="section-header">
          <h3>Export Data</h3>
          <p className="section-description">
            Export your financial data to a JSON file. Select which types of data to include.
          </p>
        </div>
        
        <div className="data-types-grid">
          <FormControlLabel control={<Checkbox checked={exportOptions.include_accounts} onChange={() => toggleExportOption('include_accounts')} />} label="Accounts" />
          <FormControlLabel control={<Checkbox checked={exportOptions.include_assets} onChange={() => toggleExportOption('include_assets')} />} label="Assets" />
          <FormControlLabel control={<Checkbox checked={exportOptions.include_liabilities} onChange={() => toggleExportOption('include_liabilities')} />} label="Liabilities" />
          <FormControlLabel control={<Checkbox checked={exportOptions.include_income} onChange={() => toggleExportOption('include_income')} />} label="Income Items" />
          <FormControlLabel control={<Checkbox checked={exportOptions.include_expenses} onChange={() => toggleExportOption('include_expenses')} />} label="Expense Items" />
          <FormControlLabel control={<Checkbox checked={exportOptions.include_projections} onChange={() => toggleExportOption('include_projections')} />} label="Projections" />
          <FormControlLabel control={<Checkbox checked={exportOptions.include_charts} onChange={() => toggleExportOption('include_charts')} />} label="Custom Charts" />
        </div>

        <div className="export-format-section">
          <div className="format-selection">
            <label className="format-label">
              <span>Export Format:</span>
              <select 
                value={exportFormat} 
                onChange={(e) => setExportFormat(e.target.value)}
                className="format-select"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </label>
          </div>
          <div className="filename-input">
            <label className="filename-label">
              <span>Filename (optional):</span>
              <input
                type="text"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder={`financial_data_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`}
                className="filename-input-field"
              />
            </label>
            <p className="filename-hint">
              If left empty, a default filename will be used.
            </p>
          </div>
        </div>

        <div className="section-actions">
          <Button 
            onClick={handleExport} 
            variant="contained"
            sx={projectionActionButtonSx}
            disabled={loading}
          >
            {loading ? 'Exporting...' : `Export Data as ${exportFormat.toUpperCase()}`}
          </Button>
        </div>
        
        {exportMessage && (
          <div className={`message ${exportMessage.includes('Error') ? 'error' : 'success'}`}>
            {exportMessage}
          </div>
        )}
      </div>

      {/* Import Section */}
      <div className="export-import-section">
        <div className="section-header">
          <h3>Import Data</h3>
          <p className="section-description">
            Import financial data from a JSON file. Select which types of data to import.
          </p>
          <p className="section-note">
            Note: Existing items with the same name will be skipped to avoid duplicates.
          </p>
        </div>

        <div className="data-types-grid">
          <FormControlLabel control={<Checkbox checked={importOptions.include_accounts} onChange={() => toggleImportOption('include_accounts')} />} label="Accounts" />
          <FormControlLabel control={<Checkbox checked={importOptions.include_assets} onChange={() => toggleImportOption('include_assets')} />} label="Assets" />
          <FormControlLabel control={<Checkbox checked={importOptions.include_liabilities} onChange={() => toggleImportOption('include_liabilities')} />} label="Liabilities" />
          <FormControlLabel control={<Checkbox checked={importOptions.include_income} onChange={() => toggleImportOption('include_income')} />} label="Income Items" />
          <FormControlLabel control={<Checkbox checked={importOptions.include_expenses} onChange={() => toggleImportOption('include_expenses')} />} label="Expense Items" />
          <FormControlLabel control={<Checkbox checked={importOptions.include_projections} onChange={() => toggleImportOption('include_projections')} />} label="Projections" />
          <FormControlLabel control={<Checkbox checked={importOptions.include_charts} onChange={() => toggleImportOption('include_charts')} />} label="Custom Charts" />
        </div>

        <div className="file-input-section">
          <label className="file-input-label">
            <span>Select JSON File:</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="file-input"
            />
          </label>
          {importFile && (
            <p className="file-selected">
              Selected: <strong>{importFile.name}</strong>
            </p>
          )}
        </div>

        <div className="section-actions">
          <Button 
            onClick={handleImport} 
            variant="contained"
            sx={projectionActionButtonSx}
            disabled={loading || !importFile}
          >
            {loading ? 'Importing...' : 'Import Data'}
          </Button>
        </div>
        
        {importMessage && (
          <div className={`message ${importMessage.includes('Error') ? 'error' : 'success'}`}>
            {importMessage}
          </div>
        )}
        {importResult && importResult.errors && importResult.errors.length > 0 && (
          <div className="error-message" style={{ marginTop: '15px' }}>
            <strong>Import Errors:</strong>
            <ul>
              {importResult.errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="settings-page-actions">
        <Button onClick={() => navigate('/app')} variant="outlined" sx={projectionSecondaryButtonSx}>Back</Button>
      </div>
    </div>
  );
};

export default ExportImportPage;


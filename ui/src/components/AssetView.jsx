import React, { useState, useRef, useMemo } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import AssetService from "../services/asset.service";
import AssetFormModal from "./AssetFormModal"; // Import the new AssetFormModal
import ConfirmDialog from "./ConfirmDialog";
import "./AssetView.css";

export default function AssetView({ assets, refreshAssets, refreshCashflow, accounts = [], validCategories = [] }) {
  const [showAssetModal, setShowAssetModal] = useState(false); // State to control modal visibility
  const [selectedAsset, setSelectedAsset] = useState(null); // State to hold asset being edited
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const tableRef = useRef(null);


  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const remove = async (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Asset',
      message: 'Delete this asset?',
      onConfirm: async () => {
        await AssetService.delete(id);
        await refreshAssets();
      }
    });
  };

  const handleAddAsset = () => {
    setSelectedAsset(null); // No asset selected for adding a new one
    setShowAssetModal(true);
  };

  const handleEditAsset = (asset) => {
    setSelectedAsset(asset); // Set the asset to be edited
    setShowAssetModal(true);
  };

  const handleCloseModal = () => {
    setShowAssetModal(false);
    setSelectedAsset(null); // Clear selected asset on close
  };

  const handleSaveSuccess = async () => {
    await refreshAssets(); // Refresh assets after save
    // Also refresh income items since "Track Interest as Taxable Income" creates/updates income items
    if (refreshCashflow) {
      await refreshCashflow();
    }
    handleCloseModal(); // Close modal on successful save
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Create account map for lookups
  const accountMap = useMemo(() => {
    const map = new Map();
    if (accounts && accounts.length > 0) {
      accounts.forEach(acc => {
        map.set(acc.id, `${acc.brokerage} - ${acc.account_name}`);
      });
    }
    return map;
  }, [accounts]);

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      if (!sortConfig.key) return 0;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle account name sorting - inline lookup to avoid function reference issues
      if (sortConfig.key === 'account') {
        aValue = accountMap.get(a.account_id) || '-';
        bValue = accountMap.get(b.account_id) || '-';
      }

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Handle numeric values
      if (sortConfig.key === 'value' || sortConfig.key === 'annual_increase_percent') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }

      // Compare values
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, sortConfig, accountMap]);

  const total = assets.reduce((sum, item) => sum + (item.value || 0), 0);

  // Download functions (unchanged)
  const handleDownloadTablePdf = async (tableRef, filename) => {
    if (tableRef.current) {
      const canvas = await html2canvas(tableRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
    } else {
    }
  };

  const convertToCsv = (dataArray, headers, valueFormatter) => {
    const csvRows = [];
    csvRows.push(headers.join(','));

    dataArray.forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        if (typeof value === 'number' && valueFormatter) {
          return `"${valueFormatter(value).replace(/"/g, '""')}"`; // Format currency and escape quotes
        }
        return `"${String(value).replace(/"/g, '""')}"`; // Escape double quotes for CSV
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  };

  const handleDownloadAssetsCsv = (filename) => {
    if (assets.length > 0) {
      const headers = ['Name', 'Category', 'Account', 'Value', 'Percent', 'Annual Change', 'Start Date', 'End Date'];
      const formattedData = assets.map(asset => ({
        Name: asset.name,
        Category: asset.category,
        Account: asset.account_id ? (accountMap.get(asset.account_id) || '-') : '-',
        Value: asset.value,
        'Percent': asset.annual_increase_percent,
        'Annual Change': asset.annual_change_type,
        'Start Date': asset.start_date,
        'End Date': asset.end_date,
      }));
      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
    }
  };

  return (
    <div className="cashflow-container">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Assets</h2>

      {/* "Add New Asset" button to open the modal */}
      <button onClick={handleAddAsset} className="add-new-item-btn">
        Add New Asset
      </button>

      <div className="table-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }}>
        <button className="btn-primary-modern" onClick={() => handleDownloadTablePdf(tableRef, "Assets_Table")}>Download PDF</button>
        <button className="btn-primary-modern" onClick={() => handleDownloadAssetsCsv("Assets_Table")}>Download CSV</button>
      </div>
      <div className="table-scroll">
        <table ref={tableRef} className="cashflow-table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="cashflow-table-cell sortable" style={{ width: '18%' }} onClick={() => handleSort('name')}>
                Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '10%' }} onClick={() => handleSort('category')}>
                Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '18%' }} onClick={() => handleSort('account')}>
                Account {sortConfig.key === 'account' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '12%' }} onClick={() => handleSort('value')}>
                Value {sortConfig.key === 'value' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('annual_change_type')}>
                Annual Chg {sortConfig.key === 'annual_change_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '7%' }} onClick={() => handleSort('annual_increase_percent')}>
              Percent {sortConfig.key === 'annual_increase_percent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('start_date')}>
              Start Date {sortConfig.key === 'start_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('end_date')}>
              End Date {sortConfig.key === 'end_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell" style={{ width: '8%' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedAssets.map((item) => {
            // Check for missing required fields (name, category, value)
            // Note: value of 0 is allowed (TESTING_PLAN.md test 2.4 assumes 0 is valid)
            const categoryValue = item.category && typeof item.category === 'string' ? item.category.trim() : (item.category || '');
            const categoryMissing = !categoryValue || (validCategories.length > 0 && !validCategories.includes(categoryValue));
            const nameMissing = !item.name;
            const valueMissing = (item.value === null || item.value === undefined);
            const hasMissingFields = nameMissing || categoryMissing || valueMissing;
            
            // All missing or invalid fields should be yellow (like other data types)
            let rowStyle = {};
            if (hasMissingFields) {
              // Missing required fields or invalid category (yellow/warning)
              rowStyle = { backgroundColor: '#fff3cd', borderLeft: '4px solid #ffc107' };
            }
            
            const missingFields = [nameMissing && 'Name', !categoryValue && 'Category', categoryMissing && categoryValue && 'Invalid Category', valueMissing && 'Value'].filter(Boolean);
            
            return (
            <tr key={item.id} style={rowStyle} title={hasMissingFields ? 'Missing required fields: ' + missingFields.join(', ') : ''}>
              <td className="cashflow-table-cell">{item.name || <span style={{ color: '#dc3545', fontStyle: 'italic' }}>Missing: Name</span>}</td>
              <td className="cashflow-table-cell">
                {categoryValue ? (
                  categoryMissing ? (
                    <span style={{ color: '#0066cc', fontStyle: 'italic', fontWeight: 'bold' }}>{item.category} (Invalid)</span>
                  ) : (
                    item.category
                  )
                ) : (
                  <span style={{ color: '#dc3545', fontStyle: 'italic' }}>Missing: Category</span>
                )}
              </td>
              <td className="cashflow-table-cell">{item.account_id ? (accountMap.get(item.account_id) || '-') : '-'}</td>
              <td className="cashflow-table-cell">{formatCurrency(item.value)}</td>
              <td className="cashflow-table-cell">{item.annual_change_type}</td>
              <td className="cashflow-table-cell">{item.annual_increase_percent}%</td>
              <td className="cashflow-table-cell">{item.start_date}</td>
              <td className="cashflow-table-cell">{item.end_date}</td>
              <td className="action-buttons-cell">
                <button onClick={() => handleEditAsset(item)} className="edit-icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                <button onClick={() => remove(item.id)} className="delete-icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="total">
        <strong>Total Assets: {formatCurrency(total)}</strong>
      </div>

      {/* Render the AssetFormModal */}
      <AssetFormModal
        isOpen={showAssetModal}
        onClose={handleCloseModal}
        item={selectedAsset}
        onSaveSuccess={handleSaveSuccess}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, title: '' })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
}
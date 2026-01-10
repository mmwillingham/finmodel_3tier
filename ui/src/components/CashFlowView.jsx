import React, { useState, useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import CashFlowService from "../services/cashflow.service";
import CashFlowFormModal from "./CashFlowFormModal"; // Import the new modal form
import ConfirmDialog from "./ConfirmDialog";
import "./CashFlowView.css";

export default function CashFlowView({ type, incomeItems, expenseItems, refreshCashflow }) {
  const items = type === 'income' ? (incomeItems || []) : (expenseItems || []);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // State to hold item being edited
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const tableRef = useRef(null);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

  const remove = async (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Item',
      message: 'Delete this item?',
      onConfirm: async () => {
        await CashFlowService.delete(id);
        await refreshCashflow();
      }
    });
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleNewItemClick = () => {
    setEditingItem(null); // No item for new entry
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingItem(null); // Clear editing item on close
  };

  const handleSaveSuccess = () => {
    refreshCashflow(); // Refresh the list after a successful save/update
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = [...items].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // Handle null/undefined values
    if (aValue == null) aValue = '';
    if (bValue == null) bValue = '';

    // Handle person field - treat null as 'Family'
    if (sortConfig.key === 'person') {
      aValue = aValue || 'Family';
      bValue = bValue || 'Family';
    }

    // Handle numeric values
    if (['yearly_value', 'annual_increase_percent', 'inflation_percent'].includes(sortConfig.key)) {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    }

    // Handle boolean values
    if (sortConfig.key === 'taxable' || sortConfig.key === 'tax_deductible') {
      aValue = aValue ? 'Yes' : 'No';
      bValue = bValue ? 'Yes' : 'No';
    }

    // Handle dynamic field
    if (sortConfig.key === 'linked_item_id') {
      aValue = aValue ? 'Yes' : 'No';
      bValue = bValue ? 'Yes' : 'No';
    }

    // Handle frequency
    if (sortConfig.key === 'frequency') {
      aValue = aValue === 'monthly' ? 'Monthly' : 'Yearly';
      bValue = bValue === 'monthly' ? 'Monthly' : 'Yearly';
    }

    // Compare values
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const total = items.reduce((sum, item) => sum + (item.yearly_value || 0), 0);

  // Download functions (remain unchanged)
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
      console.error("Table ref is not available for PDF download.");
    }
  };

  const convertToCsv = (dataArray, headers, valueFormatter) => {
    const csvRows = [];
    csvRows.push(headers.join(','));

    dataArray.forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        if (typeof value === 'number' && valueFormatter) {
          return `"${valueFormatter(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  };

  const handleDownloadCashFlowTableCsv = (filename) => {
    if (items.length > 0) {
      let headers = ['Category', 'Description', 'Person', 'Frequency', 'Yearly Value', 'Start Date', 'End Date'];
      if (type === 'income') {
        headers = [...headers, 'Annual Increase %', 'Taxable'];
      } else if (type === 'expense') {
        headers = [...headers, 'Inflation %', 'Tax Deductible'];
      }

      const formattedData = items.map(item => {
        const row = {
          Category: item.category,
          Description: item.description,
          Person: item.person || 'Family',
          Frequency: item.frequency === 'monthly' ? 'Monthly' : 'Yearly',
          'Yearly Value': item.yearly_value,
          'Start Date': item.start_date || '-',
          'End Date': item.end_date || 'No end date',
        };
        if (type === 'income') {
          row['Annual Increase %'] = item.annual_increase_percent;
          row.Taxable = item.taxable ? 'Yes' : 'No';
        } else if (type === 'expense') {
          row['Inflation %'] = item.inflation_percent;
          row['Tax Deductible'] = item.tax_deductible ? 'Yes' : 'No';
        }
        return row;
      });

      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn(`No ${type} items available for CSV download.`);
    }
  };

  return (
    <div className="cashflow-container">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>{type === 'income' ? 'Income' : 'Expenses'}</h2>

      {/* New button to open the modal for adding a new item */}
      <div className="add-new-item-section">
        <button onClick={handleNewItemClick} className="add-new-item-button">
          Add New {type === 'income' ? 'Income' : 'Expense'} Item
        </button>
      </div>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(tableRef, `${type === 'income' ? 'Income' : 'Expenses'}_Table`)}>Download PDF</button>
        <button onClick={() => handleDownloadCashFlowTableCsv(`${type === 'income' ? 'Income' : 'Expenses'}_Table`)}>Download CSV</button>
      </div>
      <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
        <table ref={tableRef} className="cashflow-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th className="cashflow-table-cell sortable" onClick={() => handleSort('category')}>
              Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" onClick={() => handleSort('description')}>
              Description {sortConfig.key === 'description' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" onClick={() => handleSort('person')}>
              Person {sortConfig.key === 'person' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" onClick={() => handleSort('frequency')}>
              Frequency {sortConfig.key === 'frequency' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" onClick={() => handleSort('yearly_value')}>
              Yearly Value {sortConfig.key === 'yearly_value' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" onClick={() => handleSort('start_date')}>
              Start Date {sortConfig.key === 'start_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" onClick={() => handleSort('end_date')}>
              End Date {sortConfig.key === 'end_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" onClick={() => handleSort('linked_item_id')}>
              Dynamic {sortConfig.key === 'linked_item_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            {type === 'income' && (
              <th className="cashflow-table-cell sortable" onClick={() => handleSort('annual_increase_percent')}>
                Annual Increase % {sortConfig.key === 'annual_increase_percent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
            )}
            {type === 'income' && (
              <th className="cashflow-table-cell sortable" onClick={() => handleSort('taxable')}>
                Taxable {sortConfig.key === 'taxable' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
            )}
            {type === 'expense' && (
              <th className="cashflow-table-cell sortable" onClick={() => handleSort('inflation_percent')}>
                Inflation % {sortConfig.key === 'inflation_percent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
            )}
            {type === 'expense' && (
              <th className="cashflow-table-cell sortable" onClick={() => handleSort('tax_deductible')}>
                Tax Deductible {sortConfig.key === 'tax_deductible' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
            )}
            <th className="cashflow-table-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map(item => (
            <tr key={item.id}>
              <td className="cashflow-table-cell">{item.category}</td>
              <td className="cashflow-table-cell">{item.description}</td>
              <td className="cashflow-table-cell">{item.person || 'Family'}</td>
              <td className="cashflow-table-cell">{item.frequency === 'monthly' ? 'Monthly' : 'Yearly'}</td>
              <td className="cashflow-table-cell">{formatCurrency(item.yearly_value)}</td>
              <td className="cashflow-table-cell">{item.start_date || '-'}</td>
              <td className="cashflow-table-cell">{item.end_date || 'No end date'}</td>
              <td className="cashflow-table-cell">{item.linked_item_id ? 'Yes' : 'No'}</td> {/* NEW: Dynamic Column Value */}
              {type === 'income' && <td className="cashflow-table-cell">{item.annual_increase_percent}%</td>}
              {type === 'income' && <td className="cashflow-table-cell">{item.taxable ? 'Yes' : 'No'}</td>}
              {type === 'expense' && <td className="cashflow-table-cell">{item.inflation_percent}%</td>}
              {type === 'expense' && <td className="cashflow-table-cell">{item.tax_deductible ? 'Yes' : 'No'}</td>}
              <td className="action-buttons-cell">
                <button onClick={() => handleEditClick(item)} className="edit-icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                <button onClick={() => remove(item.id)} className="delete-icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
              </td>
            </tr>
          ))}
        </tbody>
        
      </table>
      </div>

      <div className="total">
        <strong>Total {type === 'income' ? 'Income' : 'Expenses'} (Yearly): {formatCurrency(total)}</strong>
      </div>

      {/* Render the CashFlowFormModal */}
      <CashFlowFormModal
        isOpen={showModal}
        onClose={handleModalClose}
        item={editingItem}
        type={type}
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
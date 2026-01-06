import React, { useState, useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import LiabilityService from "../services/liability.service";
import LiabilityFormModal from "./LiabilityFormModal"; // Import the new LiabilityFormModal
import ConfirmDialog from "./ConfirmDialog";
import "./LiabilityView.css"; // Use a dedicated CSS file for LiabilityView

export default function LiabilityView({ liabilities, refreshLiabilities, refreshCashflow }) {
  const [showLiabilityModal, setShowLiabilityModal] = useState(false); // State to control modal visibility
  const [selectedLiability, setSelectedLiability] = useState(null); // State to hold liability being edited
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '' });
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
      title: 'Delete Liability',
      message: 'Delete this liability?',
      onConfirm: async () => {
        await LiabilityService.delete(id);
        await refreshLiabilities();
      }
    });
  };

  const handleAddLiability = () => {
    setSelectedLiability(null); // No liability selected for adding a new one
    setShowLiabilityModal(true);
  };

  const handleEditLiability = (liability) => {
    setSelectedLiability(liability);
    setShowLiabilityModal(true);
  };

  const handleCloseModal = () => {
    setShowLiabilityModal(false);
    setSelectedLiability(null); // Clear selected liability on close
  };

  const handleSaveSuccess = async () => {
    await refreshLiabilities(); // Refresh liabilities after save
    if (refreshCashflow) {
      await refreshCashflow(); // Also refresh expenses if a payment expense was created
    }
    handleCloseModal(); // Close modal on successful save
  };

  // Calculate total liabilities based on loan_type
  const total = liabilities.reduce((sum, item) => {
    if (item.loan_type === 'amortized') {
      return sum + (item.principal_amount || 0);
    } else { // ordinary
      return sum + (item.value || 0);
    }
  }, 0);


  // Download functions (unchanged for now, will update after UI is done)
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
        // No longer need special handling for loan_start_date as it's removed from display
        if (typeof value === 'number' && valueFormatter) {
          return `"${valueFormatter(value).replace(/"/g, '""')}"`; // Format currency and escape quotes
        }
        return `"${String(value).replace(/"/g, '""')}"`; // Escape double quotes for CSV
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  };

  const handleDownloadLiabilitiesCsv = (filename) => {
    if (liabilities.length > 0) {
      const headers = ['Name', 'Type', 'Category', 'Current Balance'];
      // No longer need conditional headers based on loan type as columns are unified
      // The individual values will be 'N/A' if not applicable.
      headers.push('Annual Rate', 'Principal Amount', 'Interest Rate', 'Loan Term (Months)', 'Monthly Payment');


      const formattedData = liabilities.map(liability => {
        const row = {
          Name: liability.name,
          Type: liability.loan_type === 'amortized' ? 'Amortized Loan' : 'Ordinary/Revolving',
          Category: liability.category,
          'Current Balance': liability.loan_type === 'amortized' ? liability.principal_amount : liability.value,
          'Annual Rate': liability.loan_type === 'ordinary' ? liability.annual_increase_percent : 'N/A',
          'Principal Amount': liability.loan_type === 'amortized' ? liability.principal_amount : 'N/A',
          'Interest Rate': liability.loan_type === 'amortized' ? liability.interest_rate : 'N/A',
          'Loan Term (Months)': liability.loan_type === 'amortized' ? liability.loan_term_months : 'N/A',
          'Monthly Payment': liability.loan_type === 'amortized' ? liability.monthly_payment : 'N/A',
        };
        return row;
      });
      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn("No data available for Liabilities CSV download.");
    }
  };

  return (
    <div className="cashflow-container">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Liabilities</h2>

      {/* "Add New Liability" button to open the modal */}
      <button onClick={handleAddLiability} className="add-new-item-btn">
        Add New Liability
      </button>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(tableRef, "Liabilities_Table")}>Download PDF</button>
        <button onClick={() => handleDownloadLiabilitiesCsv("Liabilities_Table")}>Download CSV</button>
      </div>
      <table ref={tableRef} className="cashflow-table">
        <thead>
          <tr>
            <th className="cashflow-table-cell">Name</th>
            <th className="cashflow-table-cell">Type</th> {/* NEW: Type Column */}
            <th className="cashflow-table-cell">Category</th>
            <th className="cashflow-table-cell">Current Balance</th> {/* Consolidated column */}
            <th className="cashflow-table-cell">Annual Rate</th> {/* Now always visible */}
            <th className="cashflow-table-cell">Principal Amount</th> {/* Now always visible */}
            <th className="cashflow-table-cell">Interest Rate</th> {/* Now always visible */}
            <th className="cashflow-table-cell">Loan Term (Months)</th> {/* Now always visible */}
            <th className="cashflow-table-cell">Monthly Payment</th> {/* Now always visible */}
            <th className="cashflow-table-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          {liabilities.map((item) => (
            <tr key={item.id}>
              <td className="cashflow-table-cell">{item.name}</td>
              <td className="cashflow-table-cell">
                {item.loan_type === 'amortized' ? 'Amortized Loan' : 'Ordinary/Revolving'}
              </td> {/* NEW: Type Value */}
              <td className="cashflow-table-cell">{item.category}</td>
              <td className="cashflow-table-cell">
                {item.loan_type === 'amortized' ? formatCurrency(item.principal_amount) : formatCurrency(item.value)}
              </td>
              <td className="cashflow-table-cell">
                {item.loan_type === 'ordinary' ? `${item.annual_increase_percent}%` : 'N/A'}
              </td>
              <td className="cashflow-table-cell">
                {item.loan_type === 'amortized' ? formatCurrency(item.principal_amount) : 'N/A'}
              </td>
              <td className="cashflow-table-cell">
                {item.loan_type === 'amortized' ? `${item.interest_rate}%` : 'N/A'}
              </td>
              <td className="cashflow-table-cell">
                {item.loan_type === 'amortized' ? item.loan_term_months : 'N/A'}
              </td>
              <td className="cashflow-table-cell">
                {item.loan_type === 'amortized' ? formatCurrency(item.monthly_payment) : 'N/A'}
              </td>
              <td className="action-buttons-cell">
                <button onClick={() => handleEditLiability(item)} className="edit-icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                <button onClick={() => remove(item.id)} className="delete-icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total">
        <strong>Total Liabilities: {formatCurrency(total)}</strong>
      </div>

      {/* Render the LiabilityFormModal */}
      <LiabilityFormModal
        isOpen={showLiabilityModal}
        onClose={handleCloseModal}
        item={selectedLiability}
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

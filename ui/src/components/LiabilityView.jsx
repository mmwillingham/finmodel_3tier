import React, { useState, useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import LiabilityService from "../services/liability.service";
import LiabilityFormModal from "./LiabilityFormModal"; // Import the new LiabilityFormModal
import "./LiabilityView.css"; // Use a dedicated CSS file for LiabilityView

export default function LiabilityView({ liabilities, refreshLiabilities }) {
  const [showLiabilityModal, setShowLiabilityModal] = useState(false); // State to control modal visibility
  const [selectedLiability, setSelectedLiability] = useState(null); // State to hold liability being edited
  const tableRef = useRef(null);


  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const remove = async (id) => {
    const ok = window.confirm("Delete this liability?");
    if (!ok) return;
    await LiabilityService.delete(id);
    await refreshLiabilities();
  };

  const handleAddLiability = () => {
    setSelectedLiability(null); // No liability selected for adding a new one
    setShowLiabilityModal(true);
  };

  const handleEditLiability = (liability) => {
    setSelectedLiability(liability); // Set the liability to be edited
    setShowLiabilityModal(true);
  };

  const handleCloseModal = () => {
    setShowLiabilityModal(false);
    setSelectedLiability(null); // Clear selected liability on close
  };

  const handleSaveSuccess = async () => {
    await refreshLiabilities(); // Refresh liabilities after save
    handleCloseModal(); // Close modal on successful save
  };

  const total = liabilities.reduce((sum, item) => sum + (item.value || 0), 0);

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
      const headers = ['Name', 'Category', 'Value', 'Percent', 'Annual Change', 'Start Date', 'End Date'];
      const formattedData = liabilities.map(liability => ({
        Name: liability.name,
        Category: liability.category,
        Value: liability.value,
        'Percent': liability.annual_increase_percent,
        'Annual Change': liability.annual_change_type,
        'Start Date': liability.start_date,
        'End Date': liability.end_date,
      }));
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
            <th className="cashflow-table-cell">Category</th>
            <th className="cashflow-table-cell">Value</th>
            <th className="cashflow-table-cell">Annual Change</th>
            <th className="cashflow-table-cell">Percent</th>
            <th className="cashflow-table-cell">Start Date</th>
            <th className="cashflow-table-cell">End Date</th>
            <th className="cashflow-table-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          {liabilities.map((item) => (
            <tr key={item.id}>
              <td className="cashflow-table-cell">{item.name}</td>
              <td className="cashflow-table-cell">{item.category}</td>
              <td className="cashflow-table-cell">{formatCurrency(item.value)}</td>
              <td className="cashflow-table-cell">{item.annual_change_type}</td>
              <td className="cashflow-table-cell">{item.annual_increase_percent}%</td>
              <td className="cashflow-table-cell">{item.start_date}</td>
              <td className="cashflow-table-cell">{item.end_date}</td>
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
    </div>
  );
}
import React, { useState, useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import LiabilityService from "../services/liability.service";
import LiabilityFormModal from "./LiabilityFormModal"; // Import the new LiabilityFormModal
import ConfirmDialog from "./ConfirmDialog";
import "./LiabilityView.css"; // Use a dedicated CSS file for LiabilityView

type Liability = Record<string, any>;
type SortDirection = 'asc' | 'desc';
type SortKey = string | null;

interface LiabilityViewProps {
  liabilities: Liability[];
  refreshLiabilities: () => Promise<void> | void;
  refreshCashflow?: () => Promise<void> | void;
}

export default function LiabilityView({ liabilities, refreshLiabilities, refreshCashflow }: LiabilityViewProps) {
  const [showLiabilityModal, setShowLiabilityModal] = useState(false); // State to control modal visibility
  const [selectedLiability, setSelectedLiability] = useState<Liability | null>(null); // State to hold liability being edited
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: (() => Promise<void> | void) | null; title: string }>({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: null, direction: 'asc' });
  const tableRef = useRef<HTMLTableElement | null>(null);

  const formatCurrency = (v: number | string | null | undefined) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(v ?? 0));

  const remove = async (id: number | string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Liability',
      message: 'Delete this liability?',
      onConfirm: async () => {
        await LiabilityService.delete(String(id));
        await refreshLiabilities();
      }
    });
  };

  const handleAddLiability = () => {
    setSelectedLiability(null); // No liability selected for adding a new one
    setShowLiabilityModal(true);
  };

  const handleEditLiability = (liability: Liability) => {
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

  const handleSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedLiabilities = [...liabilities].sort((a: Liability, b: Liability) => {
    if (!sortConfig.key) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // Handle null/undefined values
    if (aValue == null) aValue = '';
    if (bValue == null) bValue = '';

    // Handle numeric values
    if (['principal_amount', 'value', 'interest_rate', 'loan_term_months', 'monthly_payment'].includes(sortConfig.key)) {
      aValue = parseFloat(String(aValue)) || 0;
      bValue = parseFloat(String(bValue)) || 0;
    }

    // Handle loan_type sorting (convert to sortable string)
    if (sortConfig.key === 'loan_type') {
      aValue = a.loan_type === 'amortized' ? 'Amortized Loan' : 'Ordinary/Revolving';
      bValue = b.loan_type === 'amortized' ? 'Amortized Loan' : 'Ordinary/Revolving';
    }

    // Compare values
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate total liabilities based on loan_type
  const total = liabilities.reduce((sum: number, item: Liability) => {
    if (item.loan_type === 'amortized') {
      return sum + (item.principal_amount || 0);
    } else { // ordinary
      return sum + (item.value || 0);
    }
  }, 0);


  // Download functions (unchanged for now, will update after UI is done)
  const handleDownloadTablePdf = async (tableRef: React.RefObject<HTMLTableElement>, filename: string) => {
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

  const convertToCsv = (
    dataArray: Array<Record<string, any>>,
    headers: string[],
    valueFormatter?: (value: number) => string
  ) => {
    const csvRows: string[] = [];
    csvRows.push(headers.join(','));

    dataArray.forEach((row: Record<string, any>) => {
      const values = headers.map((header: string) => {
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

  const handleDownloadLiabilitiesCsv = (filename: string) => {
    if (liabilities.length > 0) {
      const headers = ['Name', 'Type', 'Category', 'Current Balance'];
      // No longer need conditional headers based on loan type as columns are unified
      // The individual values will be 'N/A' if not applicable.
      headers.push('Annual Rate', 'Principal Amount', 'Interest Rate', 'Loan Term (Months)', 'Monthly Payment');


      const formattedData = liabilities.map((liability: Liability) => {
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
    }
  };

  return (
    <div className="cashflow-container">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Liabilities</h2>

      {/* "Add New Liability" button to open the modal */}
      <button onClick={handleAddLiability} className="add-new-item-btn">
        Add New Liability
      </button>

      <div className="table-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }}>
        <button className="btn-primary-modern" onClick={() => handleDownloadTablePdf(tableRef, "Liabilities_Table")}>Download PDF</button>
        <button className="btn-primary-modern" onClick={() => handleDownloadLiabilitiesCsv("Liabilities_Table")}>Download CSV</button>
      </div>
      <div className="table-scroll">
        <table ref={tableRef} className="cashflow-table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {[
                <th key="name" className="cashflow-table-cell sortable" style={{ width: '13%' }} onClick={() => handleSort('name')}>
                  Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="loan_type" className="cashflow-table-cell sortable type-column" style={{ width: '11%' }} onClick={() => handleSort('loan_type')}>
                  Type {sortConfig.key === 'loan_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="category" className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('category')}>
                  Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="current_balance" className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('principal_amount')}>
                  Curr Balance {sortConfig.key === 'principal_amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="annual_rate" className="cashflow-table-cell sortable" style={{ width: '7%' }} onClick={() => handleSort('annual_increase_percent')}>
                  Ann Rate {sortConfig.key === 'annual_increase_percent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="principal" className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('principal_amount')}>
                  Principal {sortConfig.key === 'principal_amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="interest_rate" className="cashflow-table-cell sortable" style={{ width: '7%' }} onClick={() => handleSort('interest_rate')}>
                  Int Rate {sortConfig.key === 'interest_rate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="term" className="cashflow-table-cell sortable" style={{ width: '8%' }} onClick={() => handleSort('loan_term_months')}>
                  Term (Mo) {sortConfig.key === 'loan_term_months' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="monthly_pay" className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('monthly_payment')}>
                  Monthly Pay {sortConfig.key === 'monthly_payment' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="start_date" className="cashflow-table-cell sortable" style={{ width: '8%' }} onClick={() => handleSort('start_date')}>
                  Start Date {sortConfig.key === 'start_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="actions" className="cashflow-table-cell" style={{ width: '7%' }}>Actions</th>
              ]}
            </tr>
          </thead>
          <tbody>
            {sortedLiabilities.map((item: any) => {
            // Check for missing required fields (name, category, value/principal_amount)
            // For amortized loans, principal_amount is required; for ordinary, value is required
            // Note: value of 0 is allowed (TESTING_PLAN.md assumes 0 is valid)
            const hasMissingValue = item.loan_type === 'amortized' 
              ? (item.principal_amount === null || item.principal_amount === undefined)
              : (item.value === null || item.value === undefined);
            const hasMissingFields = !item.name || !item.category || hasMissingValue;
            const rowStyle = hasMissingFields ? { backgroundColor: '#fff3cd', borderLeft: '4px solid #ffc107' } : {};
            const missingFields = [
              !item.name && 'Name', 
              !item.category && 'Category', 
              hasMissingValue && (item.loan_type === 'amortized' ? 'Principal Amount' : 'Value')
            ].filter(Boolean);
            
            return (
            <tr key={item.id} style={rowStyle} title={hasMissingFields ? 'Missing required fields: ' + missingFields.join(', ') : ''}>
              {[
                <td key="name" className="cashflow-table-cell">{item.name || <span style={{ color: '#dc3545', fontStyle: 'italic' }}>Missing: Name</span>}</td>,
                <td key="type" className="cashflow-table-cell">
                  {item.loan_type === 'amortized' ? 'Amortized Loan' : 'Ordinary/Revolving'}
                </td>,
                <td key="categoryValue" className="cashflow-table-cell">{item.category || <span style={{ color: '#dc3545', fontStyle: 'italic' }}>Missing: Category</span>}</td>,
                <td key="currBalance" className="cashflow-table-cell">
                  {item.loan_type === 'amortized' ? formatCurrency(item.principal_amount) : formatCurrency(item.value)}
                </td>,
                <td key="annRate" className="cashflow-table-cell">
                  {item.loan_type === 'ordinary' ? `${item.annual_increase_percent}%` : 'N/A'}
                </td>,
                <td key="principal" className="cashflow-table-cell">
                  {item.loan_type === 'amortized' ? formatCurrency(item.principal_amount) : 'N/A'}
                </td>,
                <td key="interest" className="cashflow-table-cell">
                  {item.loan_type === 'amortized' ? `${item.interest_rate}%` : 'N/A'}
                </td>,
                <td key="term" className="cashflow-table-cell">
                  {item.loan_type === 'amortized' ? item.loan_term_months : 'N/A'}
                </td>,
                <td key="monthlyPayment" className="cashflow-table-cell">
                  {item.loan_type === 'amortized' ? formatCurrency(item.monthly_payment) : 'N/A'}
                </td>,
                <td key="startDate" className="cashflow-table-cell">{item.start_date || '-'}</td>,
                <td key="actions" className="action-buttons-cell">
                  <button onClick={() => handleEditLiability(item)} className="edit-icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                  <button onClick={() => remove(item.id)} className="delete-icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
                </td>,
              ]}
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>

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

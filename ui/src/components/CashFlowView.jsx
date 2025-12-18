import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import CashFlowService from "../services/cashflow.service";
import SettingsService from "../services/settings.service";
import "./CashFlowView.css";

export default function CashFlowView({ type, incomeItems, expenseItems, refreshCashflow }) {
  const items = type === 'income' ? (incomeItems || []) : (expenseItems || []);
  
  const [typeOptions, setTypeOptions] = useState([]);
  const [personOptions, setPersonOptions] = useState([]);
  const [defaultInflation, setDefaultInflation] = useState(2.0);
  
  const [newItem, setNewItem] = useState({ 
    category: '', 
    description: '', 
    value: '', 
    frequency: '', // Default to empty for no initial selection
    annual_increase_percent: 0,
    inflation_percent: 0, // Default to 0, not defaultInflation
    person: '', // Default to empty for no initial selection
    start_date: '',
    end_date: '',
    taxable: false,
    tax_deductible: false,
  });
  const [editingId, setEditingId] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const res = await SettingsService.getSettings();
        const inflation = res.data.default_inflation_percent;
        setDefaultInflation(inflation);
        
        // Load categories based on type
        const categories = type === 'income'
          ? res.data.income_categories?.split(",") || ["Salary", "Bonus", "Investment Income", "Other"]
          : res.data.expense_categories?.split(",") || ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(categories);
        
        // Load person names
        const persons = [
          res.data.person1_first_name ? res.data.person1_first_name : null,
          res.data.person2_first_name ? res.data.person2_first_name : null,
        ].filter(Boolean);

        // Add an empty option and "Family"
        let newPersonOptions = [""]; // Empty option for no default selection
        if (persons.length > 0) {
          newPersonOptions.push("Family", ...persons);
        } else {
          newPersonOptions.push("Family"); // Still offer 'Family' if no names are set
        }
        setPersonOptions(newPersonOptions);
        
        setNewItem(prev => ({ 
          ...prev, 
          category: '', // Ensure category is empty on load
          inflation_percent: inflation,
          person: '', // Ensure person is empty on load
          frequency: '' // Ensure frequency is empty on load
        }));
      } catch (e) {
        console.error("Failed to load settings", e);
        const defaultCategories = type === 'income'
          ? ["Salary", "Bonus", "Investment Income", "Other"]
          : ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(defaultCategories);
        setPersonOptions(["", "Person 1", "Person 2"]); // Add empty option for error case too
        setNewItem(prev => ({ ...prev, category: '', person: '', frequency: '' })); // Ensure empty defaults on error
      }
    };
    loadDefaults();
  }, [type]);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

  const save = async () => {
    if (!newItem.category || !newItem.description || !newItem.value) return;
    const payload = {
      is_income: type === 'income',
      category: newItem.category,
      description: newItem.description,
      frequency: newItem.frequency || 'yearly', // Fallback if empty
      value: parseFloat(newItem.value),
      annual_increase_percent: type === 'income' ? parseFloat(newItem.annual_increase_percent || 0) : 0,
      inflation_percent: type === 'expense' ? parseFloat(newItem.inflation_percent || defaultInflation) : 0,
      person: newItem.person || null,
      start_date: newItem.start_date || null,
      end_date: newItem.end_date || null,
      taxable: type === 'income' ? newItem.taxable : false,
      tax_deductible: type === 'expense' ? newItem.tax_deductible : false,
    };
    if (editingId) {
      await CashFlowService.update(editingId, payload);
    } else {
      await CashFlowService.create(payload);
    }
    setNewItem({ 
      category: '', 
      description: '', 
      value: '', 
      frequency: '', // Reset to empty
      annual_increase_percent: 0, 
      inflation_percent: 0, // Reset to 0
      person: '', // Reset to empty
      start_date: '',
      end_date: '',
      taxable: false,
      tax_deductible: false,
    });
    setEditingId(null);
    await refreshCashflow();
  };

  const remove = async (id) => {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;
    await CashFlowService.delete(id);
    await refreshCashflow();
  };

  const startEdit = (item) => {
    const displayValue = item.frequency === 'monthly'
      ? (item.yearly_value / 12).toString()
      : item.yearly_value.toString();
    setNewItem({
      category: item.category,
      description: item.description,
      value: displayValue,
      frequency: item.frequency,
      annual_increase_percent: item.annual_increase_percent || 0,
      inflation_percent: item.inflation_percent || defaultInflation,
      person: item.person || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      taxable: item.taxable || false,
      tax_deductible: false,
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ 
      category: '', 
      description: '', 
      value: '', 
      frequency: '', // Reset to empty
      annual_increase_percent: 0, 
      inflation_percent: 0, // Reset to 0
      person: '', // Reset to empty
      start_date: '',
      end_date: '',
      taxable: false,
      tax_deductible: false,
    });
    setEditingId(null);
  };

  const total = items.reduce((sum, item) => sum + (item.yearly_value || 0), 0);

  // Download functions
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
          Person: item.person || '-',
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

      <div className="add-item-form">
        {/* Description first, then Category */}
        <div className="form-field">
          <label htmlFor="description-input">Description (Name)</label>
          <input
            id="description-input"
            type="text"
            placeholder="Description (Name)"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="category-select">Category</label>
          <select id="category-select" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
            <option value="">Select Category</option> {/* Added empty option */}
            {typeOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="person-select">Person</label>
          <select id="person-select" value={newItem.person || ''} onChange={(e) => setNewItem({ ...newItem, person: e.target.value === "Family" ? "" : e.target.value })}>
            <option value="">Select Person</option> {/* Added empty option */}
            {personOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="value-input">Value</label>
          <input
            id="value-input"
            type="number"
            placeholder="Value"
            value={newItem.value}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="frequency-select">Frequency</label>
          <select id="frequency-select" value={newItem.frequency} onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value })}>
            <option value="">Select Frequency</option> {/* Added empty option */}
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="form-field date-field-group">
          <div className="date-field">
            <label htmlFor="start-date-input">Start Date</label>
            <input
              id="start-date-input"
              type="date"
              placeholder="Start Date"
              value={newItem.start_date}
              onChange={(e) => setNewItem({ ...newItem, start_date: e.target.value })}
            />
          </div>

          <div className="date-field">
            <label htmlFor="end-date-input">End Date</label>
            <input 
              id="end-date-input"
              type="date" 
              placeholder="End Date" 
              value={newItem.end_date || ''} 
              onChange={(e) => setNewItem({ ...newItem, end_date: e.target.value })}
            />
          </div>
        </div>

        {type === 'income' && (
          <div className="form-field">
            <label htmlFor="annual-increase">Annual Increase %</label>
            <input
              id="annual-increase"
              type="number"
              step="0.1"
              placeholder="Annual Increase %"
              value={newItem.annual_increase_percent}
              onChange={(e) => setNewItem({ ...newItem, annual_increase_percent: e.target.value })}
            />
          </div>
        )}

        {type === 'income' && (
          <div className="form-field">
            <label htmlFor="taxable">
              <input
                id="taxable"
                type="checkbox"
                checked={newItem.taxable}
                onChange={(e) => setNewItem({ ...newItem, taxable: e.target.checked })}
              />
              Taxable
            </label>
          </div>
        )}
        
        {/* Inflation % field for expenses */}
        {type === 'expense' && (
          <div className="form-field">
            <label htmlFor="inflation-percent">Inflation %</label>
            <input
              id="inflation-percent"
              type="number"
              step="0.1"
              placeholder="Inflation %"
              value={newItem.inflation_percent}
              onChange={(e) => setNewItem({ ...newItem, inflation_percent: e.target.value })}
            />
          </div>
        )}

        {type === 'expense' && (
          <div className="form-field">
            <label htmlFor="tax-deductible">
              <input
                id="tax-deductible"
                type="checkbox"
                checked={newItem.tax_deductible}
                onChange={(e) => setNewItem({ ...newItem, tax_deductible: e.target.checked })}
              />
              Tax Deductible
            </label>
          </div>
        )}

        <div className="form-actions">
          <button onClick={save} id="add-cashflow-item-button">{editingId ? 'Update' : 'Add'}</button>
          {editingId && <button onClick={cancelEdit} className="cancel-btn">Cancel</button>}
        </div>
      </div>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(tableRef, `${type === 'income' ? 'Income' : 'Expenses'}_Table`)}>Download PDF</button>
        <button onClick={() => handleDownloadCashFlowTableCsv(`${type === 'income' ? 'Income' : 'Expenses'}_Table`)}>Download CSV</button>
      </div>
      <table ref={tableRef} className="cashflow-table">
        <thead>
          <tr>
            <th className="cashflow-table-cell">Category</th>
            <th className="cashflow-table-cell">Description</th>
            <th className="cashflow-table-cell">Person</th>
            <th className="cashflow-table-cell">Frequency</th>
            <th className="cashflow-table-cell">Yearly Value</th>
            <th className="cashflow-table-cell">Start Date</th>
            <th className="cashflow-table-cell">End Date</th>
            {type === 'income' && <th className="cashflow-table-cell">Annual Increase %</th>}
            {type === 'income' && <th className="cashflow-table-cell">Taxable</th>}
            {type === 'expense' && <th className="cashflow-table-cell">Inflation %</th>}
            {type === 'expense' && <th className="cashflow-table-cell">Tax Deductible</th>}
            <th className="cashflow-table-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td className="cashflow-table-cell">{item.category}</td>
              <td className="cashflow-table-cell">{item.description}</td>
              <td className="cashflow-table-cell">{item.person || '-'}</td>
              <td className="cashflow-table-cell">{item.frequency === 'monthly' ? 'Monthly' : 'Yearly'}</td>
              <td className="cashflow-table-cell">{formatCurrency(item.yearly_value)}</td>
              <td className="cashflow-table-cell">{item.start_date || '-'}</td>
              <td className="cashflow-table-cell">{item.end_date || 'No end date'}</td>
              {type === 'income' && <td className="cashflow-table-cell">{item.annual_increase_percent}%</td>}
              {type === 'income' && <td className="cashflow-table-cell">{item.taxable ? 'Yes' : 'No'}</td>}
              {type === 'expense' && <td className="cashflow-table-cell">{item.inflation_percent}%</td>}
              {type === 'expense' && <td className="cashflow-table-cell">{item.tax_deductible ? 'Yes' : 'No'}</td>}
              <td className="action-buttons-cell">
                <button onClick={() => startEdit(item)} className="edit-icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                <button onClick={() => remove(item.id)} className="delete-icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total">
        <strong>Total {type === 'income' ? 'Income' : 'Expenses'} (Yearly): {formatCurrency(total)}</strong>
      </div>
    </div>
  );
}
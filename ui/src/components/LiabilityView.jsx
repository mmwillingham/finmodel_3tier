import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import LiabilityService from "../services/liability.service";
import SettingsService from "../services/settings.service";
import "./CashFlowView.css";

export default function LiabilityView({ liabilities, refreshLiabilities }) {
  const [categories, setCategories] = useState([]);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "Other",
    value: "",
    annual_increase_percent: 0,
    annual_change_type: "increase",
    start_date: "", // New field
    end_date: "",   // New field
  });
  const [editingId, setEditingId] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await SettingsService.getSettings();
        const cats = res.data.liability_categories?.split(",") || ["Other"];
        setCategories(cats);
        setNewItem((prev) => ({ ...prev, category: cats[0] }));
      } catch (e) {
        console.error("Failed to load settings", e);
        setCategories(["Other"]);
      }
    };
    loadSettings();
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const save = async () => {
    if (!newItem.name || !newItem.category || !newItem.value) return;
    const payload = {
      name: newItem.name,
      category: newItem.category,
      value: parseFloat(newItem.value),
      annual_increase_percent: parseFloat(newItem.annual_increase_percent || 0),
      annual_change_type: newItem.annual_change_type,
      start_date: newItem.start_date || null, // Include new fields
      end_date: newItem.end_date || null,     // Include new fields
    };
    if (editingId) {
      await LiabilityService.update(editingId, payload);
    } else {
      await LiabilityService.create(payload);
    }
    setNewItem({ name: "", category: categories[0], value: "", annual_increase_percent: 0, start_date: "", end_date: "" });
    setEditingId(null);
    await refreshLiabilities();
  };

  const remove = async (id) => {
    const ok = window.confirm("Delete this liability?");
    if (!ok) return;
    await LiabilityService.delete(id);
    await refreshLiabilities();
  };

  const startEdit = (item) => {
    setNewItem({
      name: item.name,
      category: item.category,
      value: item.value.toString(),
      annual_increase_percent: item.annual_increase_percent || 0,
      annual_change_type: item.annual_change_type || "increase",
      start_date: item.start_date || "", // Set new fields for editing
      end_date: item.end_date || "",     // Set new fields for editing
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ name: "", category: categories[0], value: "", annual_increase_percent: 0, annual_change_type: "increase", start_date: "", end_date: "" });
    setEditingId(null);
  };

  const total = liabilities.reduce((sum, item) => sum + (item.value || 0), 0);

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
      <h2>Liabilities</h2>

      <div className="add-item-form">
        <input
          type="text"
          placeholder="Name"
          value={newItem.name}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
        />

        <select
          value={newItem.category}
          onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Value"
          value={newItem.value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
        />

        <div className="form-field">
          <label htmlFor="annual-change-percent">Percent</label>
          <input
            id="annual-change-percent"
            type="number"
            step="0.1"
            placeholder="Percent"
            value={newItem.annual_increase_percent}
            onChange={(e) => setNewItem({ ...newItem, annual_increase_percent: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="annual-change-type">Annual Change</label>
          <select
            id="annual-change-type"
            value={newItem.annual_change_type}
            onChange={(e) => setNewItem({ ...newItem, annual_change_type: e.target.value })}
          >
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
          </select>
        </div>

        {/* New Start and End Date Fields */}
        <div className="form-field">
          <label htmlFor="start-date">Start Date</label>
          <input
            id="start-date"
            type="date"
            value={newItem.start_date}
            onChange={(e) => setNewItem({ ...newItem, start_date: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="end-date">End Date</label>
          <input
            id="end-date"
            type="date"
            value={newItem.end_date}
            onChange={(e) => setNewItem({ ...newItem, end_date: e.target.value })}
          />
        </div>

        <div className="form-actions">
          <button onClick={save}>{editingId ? "Update" : "Add"}</button>
          {editingId && (
            <button onClick={cancelEdit} className="cancel-btn">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(tableRef, "Liabilities_Table")}>Download PDF</button>
        <button onClick={() => handleDownloadLiabilitiesCsv("Liabilities_Table")}>Download CSV</button>
      </div>
      <table ref={tableRef} className="cashflow-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Value</th>
            <th>Annual Change</th>
            <th>Percent</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {liabilities.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.category}</td>
              <td>{formatCurrency(item.value)}</td>
              <td>{item.annual_change_type}</td>
              <td>{item.annual_increase_percent}%</td>
              <td>{item.start_date}</td>
              <td>{item.end_date}</td>
              <td>
                <button onClick={() => startEdit(item)} className="edit-btn-small">
                  Edit
                </button>
                <button onClick={() => remove(item.id)} className="delete-btn-small">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total">
        <strong>Total Liabilities: {formatCurrency(total)}</strong>
      </div>
    </div>
  );
}

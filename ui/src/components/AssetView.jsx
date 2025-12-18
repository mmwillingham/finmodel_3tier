import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import AssetService from "../services/asset.service";
import SettingsService from "../services/settings.service";
import "./AssetView.css"; // Changed to AssetView.css

export default function AssetView({ assets, refreshAssets }) {
  const [categories, setCategories] = useState([]);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "", // No default category
    value: "",
    annual_increase_percent: 0,
    annual_change_type: "", // No default annual change type
    start_date: "",
    end_date: "",
  });
  const [editingId, setEditingId] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await SettingsService.getSettings();
        const cats = res.data.asset_categories?.split(",") || [];
        setCategories(cats);
        setNewItem((prev) => ({ ...prev, category: "", annual_change_type: "" })); // Ensure no default on load
      } catch (e) {
        console.error("Failed to load settings", e);
        setCategories([]);
        setNewItem((prev) => ({ ...prev, category: "", annual_change_type: "" })); // Ensure no default on error
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
    if (!newItem.name || !newItem.category || !newItem.value || !newItem.annual_change_type) return;
    const payload = {
      name: newItem.name,
      category: newItem.category,
      value: parseFloat(newItem.value),
      annual_increase_percent: parseFloat(newItem.annual_increase_percent || 0),
      annual_change_type: newItem.annual_change_type,
      start_date: newItem.start_date || null,
      end_date: newItem.end_date || null,
    };
    if (editingId) {
      await AssetService.update(editingId, payload);
    } else {
      await AssetService.create(payload);
    }
    setNewItem({ name: "", category: "", value: "", annual_increase_percent: 0, annual_change_type: "", start_date: "", end_date: "" }); // Reset to empty
    setEditingId(null);
    await refreshAssets();
  };

  const remove = async (id) => {
    const ok = window.confirm("Delete this asset?");
    if (!ok) return;
    await AssetService.delete(id);
    await refreshAssets();
  };

  const startEdit = (item) => {
    setNewItem({
      name: item.name,
      category: item.category,
      value: item.value.toString(),
      annual_increase_percent: item.annual_increase_percent || 0,
      annual_change_type: item.annual_change_type || "",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ name: "", category: "", value: "", annual_increase_percent: 0, annual_change_type: "", start_date: "", end_date: "" }); // Reset to empty
    setEditingId(null);
  };

  const total = assets.reduce((sum, item) => sum + (item.value || 0), 0);

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
        }asd
        return `"${String(value).replace(/"/g, '""')}"`; // Escape double quotes for CSV
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  };

  const handleDownloadAssetsCsv = (filename) => {
    if (assets.length > 0) {
      const headers = ['Name', 'Category', 'Value', 'Percent', 'Annual Change', 'Start Date', 'End Date'];
      const formattedData = assets.map(asset => ({
        Name: asset.name,
        Category: asset.category,
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
      console.warn("No data available for Assets CSV download.");
    }
  };

  return (
    <div className="cashflow-container">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Assets</h2>

      <div className="add-item-form">
        <div className="form-field">
          <label htmlFor="asset-name">Name</label>
          <input
            id="asset-name"
            type="text"
            placeholder="Name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="asset-category">Category</label>
          <select
            id="asset-category"
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="asset-value">Value</label>
          <input
            id="asset-value"
            type="number"
            placeholder="Value"
            value={newItem.value}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
          />
        </div>

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
            <option value="">Select Change Type</option>
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
          </select>
        </div>

        {/* New Start and End Date Fields */}
        <div className="form-field date-field-group">
          <div className="date-field">
            <label htmlFor="start-date">Start Date</label>
            <input
              id="start-date"
              type="date"
              value={newItem.start_date}
              onChange={(e) => setNewItem({ ...newItem, start_date: e.target.value })}
            />
          </div>

          <div className="date-field">
            <label htmlFor="end-date">End Date</label>
            <input
              id="end-date"
              type="date"
              value={newItem.end_date}
              onChange={(e) => setNewItem({ ...newItem, end_date: e.target.value })}
            />
          </div>
        </div>

        <div className="form-actions">
          <button onClick={save} id="add-asset-item-button">{editingId ? "Update" : "Add"}</button>
          {editingId && (
            <button onClick={cancelEdit} className="cancel-btn">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(tableRef, "Assets_Table")}>Download PDF</button>
        <button onClick={() => handleDownloadAssetsCsv("Assets_Table")}>Download CSV</button>
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
          {assets.map((item) => (
            <tr key={item.id}>
              <td className="cashflow-table-cell">{item.name}</td>
              <td className="cashflow-table-cell">{item.category}</td>
              <td className="cashflow-table-cell">{formatCurrency(item.value)}</td>
              <td className="cashflow-table-cell">{item.annual_change_type}</td>
              <td className="cashflow-table-cell">{item.annual_increase_percent}%</td>
              <td className="cashflow-table-cell">{item.start_date}</td>
              <td className="cashflow-table-cell">{item.end_date}</td>
              <td className="action-buttons-cell">
                <button onClick={() => startEdit(item)} className="edit-icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                <button onClick={() => remove(item.id)} className="delete-icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total">
        <strong>Total Assets: {formatCurrency(total)}</strong>
      </div>
    </div>
  );
}
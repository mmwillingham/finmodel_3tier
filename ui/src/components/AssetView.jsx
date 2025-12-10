import React, { useState, useEffect } from "react";
import AssetService from "../services/asset.service";
import SettingsService from "../services/settings.service";
import "./CashFlowView.css";

export default function AssetView({ assets, refreshAssets }) {
  const [categories, setCategories] = useState([]);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "Other",
    value: "",
    annual_increase_percent: 0,
    start_date: "", // New field
    end_date: "",   // New field
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await SettingsService.getSettings();
        const cats = res.data.asset_categories?.split(",") || ["Other"];
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
      start_date: newItem.start_date || null, // Include new fields
      end_date: newItem.end_date || null,     // Include new fields
    };
    if (editingId) {
      await AssetService.update(editingId, payload);
    } else {
      await AssetService.create(payload);
    }
    setNewItem({ name: "", category: categories[0], value: "", annual_increase_percent: 0, start_date: "", end_date: "" });
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
      start_date: item.start_date || "", // Set new fields for editing
      end_date: item.end_date || "",     // Set new fields for editing
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ name: "", category: categories[0], value: "", annual_increase_percent: 0, start_date: "", end_date: "" });
    setEditingId(null);
  };

  const total = assets.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="cashflow-container">
      <h2>Assets</h2>

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
          <label htmlFor="annual-increase">Annual Increase %</label>
          <input
            id="annual-increase"
            type="number"
            step="0.1"
            placeholder="Annual Increase %"
            value={newItem.annual_increase_percent}
            onChange={(e) =>
              setNewItem({ ...newItem, annual_increase_percent: e.target.value })
            }
          />
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

      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Value</th>
            <th>Annual Increase %</th>
            <th>Start Date</th>{/* New Table Header */}
            <th>End Date</th>  {/* New Table Header */}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.category}</td>
              <td>{formatCurrency(item.value)}</td>
              <td>{item.annual_increase_percent}%</td>
              <td>{item.start_date}</td>{/* New Table Data */}
              <td>{item.end_date}</td>  {/* New Table Data */}
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
        <strong>Total Assets: {formatCurrency(total)}</strong>
      </div>
    </div>
  );
}

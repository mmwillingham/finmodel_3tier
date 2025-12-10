import React, { useState, useEffect } from "react";
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
  });
  const [editingId, setEditingId] = useState(null);

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
    };
    if (editingId) {
      await LiabilityService.update(editingId, payload);
    } else {
      await LiabilityService.create(payload);
    }
    setNewItem({ name: "", category: categories[0], value: "", annual_increase_percent: 0 });
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
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ name: "", category: categories[0], value: "", annual_increase_percent: 0 });
    setEditingId(null);
  };

  const total = liabilities.reduce((sum, item) => sum + (item.value || 0), 0);

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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {liabilities.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.category}</td>
              <td>{formatCurrency(item.value)}</td>
              <td>{item.annual_increase_percent}%</td>
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

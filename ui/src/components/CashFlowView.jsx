import React, { useState, useEffect } from "react";
import CashFlowService from "../services/cashflow.service";
import SettingsService from "../services/settings.service";
import "./CashFlowView.css";

export default function CashFlowView({ type, incomeItems, expenseItems, refreshCashflow }) {
  const items = type === 'income' ? incomeItems : expenseItems;
  
  const typeOptions = type === 'income'
    ? ["Salary", "Bonus", "Investment Income", "Other"]
    : ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
  
  const defaultType = typeOptions[0];
  const [defaultInflation, setDefaultInflation] = useState(2.0);
  
  const [newItem, setNewItem] = useState({ 
    category: defaultType, 
    description: '', 
    value: '', 
    frequency: 'yearly',
    annual_increase_percent: 0,
    inflation_percent: 2.0,
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const res = await SettingsService.getSettings();
        const inflation = res.data.default_inflation_percent;
        setDefaultInflation(inflation);
        setNewItem(prev => ({ ...prev, inflation_percent: inflation }));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    };
    loadDefaults();
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

  const save = async () => {
    if (!newItem.category || !newItem.description || !newItem.value) return;
    const payload = {
      is_income: type === 'income',
      category: newItem.category,
      description: newItem.description,
      frequency: newItem.frequency,
      value: parseFloat(newItem.value),
      annual_increase_percent: type === 'income' ? parseFloat(newItem.annual_increase_percent || 0) : 0,
      inflation_percent: type === 'expense' ? parseFloat(newItem.inflation_percent || defaultInflation) : 0,
    };
    if (editingId) {
      await CashFlowService.update(editingId, payload);
    } else {
      await CashFlowService.create(payload);
    }
    setNewItem({ 
      category: defaultType, 
      description: '', 
      value: '', 
      frequency: 'yearly', 
      annual_increase_percent: 0, 
      inflation_percent: defaultInflation 
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
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ 
      category: defaultType, 
      description: '', 
      value: '', 
      frequency: 'yearly', 
      annual_increase_percent: 0, 
      inflation_percent: defaultInflation 
    });
    setEditingId(null);
  };

  const total = items.reduce((sum, item) => sum + (item.yearly_value || 0), 0);

  return (
    <div className="cashflow-container">
      <h2>{type === 'income' ? 'Income' : 'Expenses'}</h2>

      <div className="add-item-form">
        <select value={newItem.category || defaultType} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
          <option value="">Select Type</option>
          {typeOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
        </select>

        <input type="text" placeholder="Description" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />

        <select value={newItem.frequency} onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value })}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        <input type="number" placeholder="Value" value={newItem.value} onFocus={(e) => e.target.select()} onChange={(e) => setNewItem({ ...newItem, value: e.target.value })} />

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

        {type === 'expense' && (
          <div className="form-field">
            <label htmlFor="inflation">Inflation %</label>
            <input
              id="inflation"
              type="number"
              step="0.1"
              placeholder="Inflation %"
              value={newItem.inflation_percent}
              onChange={(e) => setNewItem({ ...newItem, inflation_percent: e.target.value })}
            />
          </div>
        )}

        <div className="form-actions">
          <button onClick={save}>{editingId ? 'Update' : 'Add'}</button>
          {editingId && <button onClick={cancelEdit} className="cancel-btn">Cancel</button>}
        </div>
      </div>

      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
            <th>Frequency</th>
            <th>Yearly Value</th>
            {type === 'income' && <th>Annual Increase %</th>}
            {type === 'expense' && <th>Inflation %</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.category}</td>
              <td>{item.description}</td>
              <td>{item.frequency === 'monthly' ? 'Monthly' : 'Yearly'}</td>
              <td>{formatCurrency(item.yearly_value)}</td>
              <td>{type === 'income' ? item.annual_increase_percent : item.inflation_percent}%</td>
              <td>
                <button onClick={() => startEdit(item)} className="edit-btn-small">Edit</button>
                <button onClick={() => remove(item.id)} className="delete-btn-small">Delete</button>
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
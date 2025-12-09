import React, { useState, useEffect } from 'react';
import CashFlowService from '../services/cashflow.service';
import './CashFlowView.css';

const INCOME_TYPES = ['Salary', 'Interest', 'Dividends', 'Social Security', 'Pension'];
const EXPENSE_TYPES = ['401k', 'Charitable Giving', 'Health', 'Tax', 'Food', 'Home', 'Insurance', 'Clothing', 'Hobbies', 'Transportation', 'Other'];

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

export default function CashFlowView({ type, incomeItems, expenseItems, refreshCashflow }) {
  const [newItem, setNewItem] = useState({ category: '', description: '', value: '', frequency: 'yearly' });
  const [editingId, setEditingId] = useState(null);

  const typeOptions = type === 'income' ? INCOME_TYPES : EXPENSE_TYPES;
  const defaultType = typeOptions?.[0] ?? '';
  const items = type === 'income' ? incomeItems : expenseItems;

  useEffect(() => {
    setNewItem({ category: defaultType, description: '', value: '', frequency: 'yearly' });
    setEditingId(null);
  }, [type, defaultType]);

  if (!type) return null;

  const save = async () => {
    if (!newItem.category || !newItem.description || !newItem.value) return;
    const payload = {
      is_income: type === 'income',
      category: newItem.category,
      description: newItem.description,
      frequency: newItem.frequency,
      value: parseFloat(newItem.value),
    };
    if (editingId) {
      await CashFlowService.update(editingId, payload);
    } else {
      await CashFlowService.create(payload);
    }
    setNewItem({ category: defaultType, description: '', value: '', frequency: 'yearly' });
    setEditingId(null);
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
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ category: defaultType, description: '', value: '', frequency: 'yearly' });
    setEditingId(null);
  };

  const remove = async (id) => {
    await CashFlowService.remove(id);
    await refreshCashflow();
  };

  const total = items.reduce((s, i) => s + i.yearly_value, 0);
  const title = type === 'income' ? 'Income' : 'Expenses';

  return (
    <div className="cashflow-container">
      <h2>{title}</h2>

      <div className="add-item-form">
        <select
          value={newItem.category || defaultType}
          onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
        >
          <option value="">Select Type</option>
          {typeOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Description"
          value={newItem.description}
          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
        />

        <select
          value={newItem.frequency}
          onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value })}
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        <input
          type="number"
          placeholder="Value"
          value={newItem.value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
        />

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
              <td>
                <button onClick={() => startEdit(item)} className="edit-btn-small">Edit</button>
                <button onClick={() => remove(item.id)} className="delete-btn-small">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total">
        <strong>Total {title} (Yearly): {formatCurrency(total)}</strong>
      </div>
    </div>
  );
}
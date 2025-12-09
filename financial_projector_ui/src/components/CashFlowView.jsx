import React, { useState } from 'react';
import './CashFlowView.css';

const INCOME_TYPES = ['Salary', 'Interest', 'Dividends', 'Social Security', 'Pension'];
const EXPENSE_TYPES = ['401k', 'Charitable Giving', 'Health', 'Tax', 'Food', 'Home', 'Insurance', 'Clothing', 'Hobbies', 'Transportation', 'Other'];

export default function CashFlowView({ type }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ type: '', description: '', value: '', frequency: 'yearly' });
  const [editingId, setEditingId] = useState(null);

  const typeOptions = type === 'income' ? INCOME_TYPES : EXPENSE_TYPES;
  const defaultType = typeOptions[0];

  const addItem = () => {
    if (newItem.type && newItem.description && newItem.value) {
      const yearlyValue = newItem.frequency === 'monthly' 
        ? parseFloat(newItem.value) * 12 
        : parseFloat(newItem.value);

      if (editingId) {
        // Update existing item
        setItems(items.map(item => 
          item.id === editingId 
            ? { ...item, type: newItem.type, description: newItem.description, yearlyValue, frequency: newItem.frequency }
            : item
        ));
        setEditingId(null);
      } else {
        // Add new item
        setItems([...items, { 
          id: Date.now(), 
          type: newItem.type, 
          description: newItem.description, 
          yearlyValue,
          frequency: newItem.frequency
        }]);
      }
      setNewItem({ type: defaultType, description: '', value: '', frequency: 'yearly' });
    }
  };

  const editItem = (item) => {
    const displayValue = item.frequency === 'monthly' 
      ? (item.yearlyValue / 12).toString() 
      : item.yearlyValue.toString();
    
    setNewItem({ 
      type: item.type, 
      description: item.description, 
      value: displayValue,
      frequency: item.frequency
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ type: defaultType, description: '', value: '', frequency: 'yearly' });
    setEditingId(null);
  };

  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const total = items.reduce((sum, item) => sum + item.yearlyValue, 0);
  const title = type === 'income' ? 'Income' : 'Expenses';

  return (
    <div className="cashflow-container">
      <h2>{title}</h2>

      <div className="add-item-form">
        <select
          value={newItem.type || defaultType}
          onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
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
          <button onClick={addItem}>{editingId ? 'Update' : 'Add'}</button>
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
              <td>{item.type}</td>
              <td>{item.description}</td>
              <td>{item.frequency === 'monthly' ? 'Monthly' : 'Yearly'}</td>
              <td>${item.yearlyValue.toFixed(2)}</td>
              <td>
                <button onClick={() => editItem(item)} className="edit-btn-small">Edit</button>
                <button onClick={() => deleteItem(item.id)} className="delete-btn-small">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total">
        <strong>Total {title} (Yearly): ${total.toFixed(2)}</strong>
      </div>
    </div>
  );
}
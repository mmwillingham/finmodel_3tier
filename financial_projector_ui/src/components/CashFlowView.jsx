import React, { useState } from 'react';
import './CashFlowView.css';

const INCOME_TYPES = ['Salary', 'Interest', 'Dividends', 'Social Security', 'Pension'];
const EXPENSE_TYPES = ['401k', 'Charitable Giving', 'Health', 'Tax', 'Food', 'Home', 'Insurance', 'Clothing', 'Hobbies', 'Transportation', 'Other'];

export default function CashFlowView({ type }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ type: '', description: '', value: '' });

  const typeOptions = type === 'income' ? INCOME_TYPES : EXPENSE_TYPES;
  const defaultType = typeOptions[0];

  const addItem = () => {
    if (newItem.type && newItem.description && newItem.value) {
      setItems([...items, { id: Date.now(), ...newItem, value: parseFloat(newItem.value) }]);
      setNewItem({ type: defaultType, description: '', value: '' });
    }
  };

  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const total = items.reduce((sum, item) => sum + item.value, 0);
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

        <input
          type="number"
          placeholder="Value"
          value={newItem.value}
          onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
        />

        <button onClick={addItem}>Add</button>
      </div>

      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
            <th>Value</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.type}</td>
              <td>{item.description}</td>
              <td>${item.value.toFixed(2)}</td>
              <td>
                <button onClick={() => deleteItem(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total">
        <strong>Total {title}: ${total.toFixed(2)}</strong>
      </div>
    </div>
  );
}
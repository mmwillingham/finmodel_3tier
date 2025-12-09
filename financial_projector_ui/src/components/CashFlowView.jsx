import React, { useState } from 'react';
import './CashFlowView.css';

export default function CashFlowView({ type }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ description: '', amount: '' });

  const addItem = () => {
    if (newItem.description && newItem.amount) {
      setItems([...items, { id: Date.now(), ...newItem, amount: parseFloat(newItem.amount) }]);
      setNewItem({ description: '', amount: '' });
    }
  };

  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const title = type === 'income' ? 'Income' : 'Expenses';

  return (
    <div className="cashflow-container">
      <h2>{title}</h2>

      <div className="add-item-form">
        <input
          type="text"
          placeholder="Description"
          value={newItem.description}
          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
        />
        <input
          type="number"
          placeholder="Amount"
          value={newItem.amount}
          onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
        />
        <button onClick={addItem}>Add</button>
      </div>

      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td>${item.amount.toFixed(2)}</td>
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
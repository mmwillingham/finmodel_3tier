import React, { useState, useEffect } from "react";
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
    frequency: 'yearly',
    annual_increase_percent: 0,
    inflation_percent: 2.0,
    person: '',
    start_date: '',
    end_date: '',
    taxable: false,
    tax_deductible: false,
  });
  const [editingId, setEditingId] = useState(null);

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
          res.data.person1_name || "Person 1",
          res.data.person2_name || "Person 2"
        ];
        setPersonOptions(persons);
        
        setNewItem(prev => ({ 
          ...prev, 
          category: categories[0],
          inflation_percent: inflation 
        }));
      } catch (e) {
        console.error("Failed to load settings", e);
        const defaultCategories = type === 'income'
          ? ["Salary", "Bonus", "Investment Income", "Other"]
          : ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(defaultCategories);
        setPersonOptions(["Person 1", "Person 2"]);
        setNewItem(prev => ({ ...prev, category: defaultCategories[0] }));
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
      frequency: newItem.frequency,
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
      category: typeOptions[0], 
      description: '', 
      value: '', 
      frequency: 'yearly', 
      annual_increase_percent: 0, 
      inflation_percent: defaultInflation,
      person: '',
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
      tax_deductible: item.tax_deductible || false,
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setNewItem({ 
      category: typeOptions[0], 
      description: '', 
      value: '', 
      frequency: 'yearly', 
      annual_increase_percent: 0, 
      inflation_percent: defaultInflation,
      person: '',
      start_date: '',
      end_date: '',
      taxable: false,
      tax_deductible: false,
    });
    setEditingId(null);
  };

  const total = items.reduce((sum, item) => sum + (item.yearly_value || 0), 0);

  return (
    <div className="cashflow-container">
      <h2>{type === 'income' ? 'Income' : 'Expenses'}</h2>

      <div className="add-item-form">
        <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
          {typeOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
        </select>

        <input type="text" placeholder="Description (Name)" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />

        <select value={newItem.person || ''} onChange={(e) => setNewItem({ ...newItem, person: e.target.value })}>
          <option value="">Optional: Select Person</option>
          {personOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
        </select>

        <input type="number" placeholder="Value" value={newItem.value} onFocus={(e) => e.target.select()} onChange={(e) => setNewItem({ ...newItem, value: e.target.value })} />

        <select value={newItem.frequency} onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value })}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        <input type="date" placeholder="Start Date" value={newItem.start_date} onChange={(e) => setNewItem({ ...newItem, start_date: e.target.value })} />

        <div className="form-field">
          <label htmlFor="end-date-input">End Date</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              id="end-date-input"
              type="date" 
              placeholder="End Date" 
              value={newItem.end_date || ''} 
              onChange={(e) => setNewItem({ ...newItem, end_date: e.target.value })}
              disabled={!newItem.end_date}
            />
            <label style={{ whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={!newItem.end_date}
                onChange={(e) => setNewItem({ ...newItem, end_date: e.target.checked ? '' : new Date().toISOString().split('T')[0] })}
              />
              No end date
            </label>
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
          <button onClick={save}>{editingId ? 'Update' : 'Add'}</button>
          {editingId && <button onClick={cancelEdit} className="cancel-btn">Cancel</button>}
        </div>
      </div>

      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Description</th>
            <th>Person</th>
            <th>Frequency</th>
            <th>Yearly Value</th>
            <th>Start Date</th>
            <th>End Date</th>
            {type === 'income' && <th>Annual Increase %</th>}
            {type === 'income' && <th>Taxable</th>}
            {type === 'expense' && <th>Inflation %</th>}
            {type === 'expense' && <th>Tax Deductible</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.category}</td>
              <td>{item.description}</td>
              <td>{item.person || '-'}</td>
              <td>{item.frequency === 'monthly' ? 'Monthly' : 'Yearly'}</td>
              <td>{formatCurrency(item.yearly_value)}</td>
              <td>{item.start_date || '-'}</td>
              <td>{item.end_date || 'No end date'}</td>
              {type === 'income' && <td>{item.annual_increase_percent}%</td>}
              {type === 'income' && <td>{item.taxable ? 'Yes' : 'No'}</td>}
              {type === 'expense' && <td>{item.inflation_percent}%</td>}
              {type === 'expense' && <td>{item.tax_deductible ? 'Yes' : 'No'}</td>}
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
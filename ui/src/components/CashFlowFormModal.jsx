import React, { useState, useEffect } from "react";
import CashFlowService from "../services/cashflow.service";
import SettingsService from "../services/settings.service";
import Modal from "./Modal"; // Import the generic Modal component
import "./CashFlowFormModal.css"; // Specific styling for this form

export default function CashFlowFormModal({
  isOpen, // From Modal component
  onClose, // From Modal component
  item: itemToEdit, // The item data if we're editing
  type, // 'income' or 'expense'
  onSaveSuccess, // Callback after successful save
}) {
  const [typeOptions, setTypeOptions] = useState([]);
  const [personOptions, setPersonOptions] = useState([]);
  const [defaultInflation, setDefaultInflation] = useState(2.0);

  const [newItem, setNewItem] = useState({
    category: "",
    description: "",
    value: "",
    frequency: "",
    annual_increase_percent: 0,
    inflation_percent: 0,
    person: "",
    start_date: "",
    end_date: "",
    taxable: false,
    tax_deductible: false,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await SettingsService.getSettings();
        const inflation = res.data.default_inflation_percent;
        setDefaultInflation(inflation);

        const categories = type === "income"
          ? res.data.income_categories?.split(",") || ["Salary", "Bonus", "Investment Income", "Other"]
          : res.data.expense_categories?.split(",") || ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(categories);

        const persons = [
          res.data.person1_first_name ? res.data.person1_first_name : null,
          res.data.person2_first_name ? res.data.person2_first_name : null,
        ].filter(Boolean);

        let newPersonOptions = ["Select Person"];
        if (persons.length > 0) {
          newPersonOptions.push("Family", ...persons);
        } else {
          newPersonOptions.push("Family");
        }
        setPersonOptions(newPersonOptions);

        // Set form data if editing, otherwise ensure empty defaults
        if (itemToEdit) {
          const displayValue = itemToEdit.frequency === 'monthly'
            ? (itemToEdit.yearly_value / 12).toString()
            : itemToEdit.yearly_value.toString();
          setNewItem({
            category: itemToEdit.category || '',
            description: itemToEdit.description || '',
            value: displayValue,
            frequency: itemToEdit.frequency || '',
            annual_increase_percent: itemToEdit.annual_increase_percent || 0,
            inflation_percent: itemToEdit.inflation_percent || inflation,
            person: itemToEdit.person || '',
            start_date: itemToEdit.start_date || '',
            end_date: itemToEdit.end_date || '',
            taxable: itemToEdit.taxable || false,
            tax_deductible: itemToEdit.tax_deductible || false,
          });
        } else {
          // Ensure empty defaults for new item
          setNewItem(prev => ({
            ...prev,
            category: "",
            description: "",
            value: "",
            frequency: "",
            annual_increase_percent: 0,
            inflation_percent: inflation, // Default to fetched inflation for new expenses
            person: "",
            start_date: "",
            end_date: "",
            taxable: false,
            tax_deductible: false,
          }));
        }
      } catch (e) {
        console.error("Failed to load settings", e);
        const defaultCategories = type === "income"
          ? ["Salary", "Bonus", "Investment Income", "Other"]
          : ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(defaultCategories);
        setPersonOptions(["Select Person", "Person 1", "Person 2"]);
        if (!itemToEdit) {
          setNewItem(prev => ({ ...prev, category: "", person: "", frequency: "", inflation_percent: 0 }));
        }
      }
    };
    loadSettings();
  }, [itemToEdit, type]);

  const save = async () => {
    if (!newItem.category || !newItem.description || !newItem.value) return;

    const payload = {
      is_income: type === "income",
      category: newItem.category,
      description: newItem.description,
      frequency: newItem.frequency || "yearly", // Fallback if empty
      value: parseFloat(newItem.value),
      annual_increase_percent: type === "income" ? parseFloat(newItem.annual_increase_percent || 0) : 0,
      inflation_percent: type === "expense" ? parseFloat(newItem.inflation_percent || defaultInflation) : 0,
      person: newItem.person === "Select Person" || newItem.person === "Family" ? null : newItem.person || null,
      start_date: newItem.start_date || null,
      end_date: newItem.end_date || null,
      taxable: type === "income" ? newItem.taxable : false,
      tax_deductible: type === "expense" ? newItem.tax_deductible : false,
    };

    try {
      if (itemToEdit) {
        await CashFlowService.update(itemToEdit.id, payload);
      } else {
        await CashFlowService.create(payload);
      }
      onSaveSuccess(); // Notify parent of successful save
      onClose(); // Close the modal
    } catch (error) {
      console.error("Failed to save cash flow item:", error);
      // Optionally, show an error message to the user
    }
  };

  const cancelEdit = () => {
    onClose(); // Just close the modal on cancel
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.description}` : `Add New ${type === 'income' ? 'Income' : 'Expense'} Item`}>
      <div className="cashflow-form-modal-content">
        <div className="add-item-form">
          {/* Description first, then Category */}
          <div className="form-field">
            <label htmlFor="description-input">Description (Name)</label>
            <input
              id="description-input"
              type="text"
              placeholder="Description (Name)"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="category-select">Category</label>
            <select id="category-select" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
              <option value="">Select Category</option>
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="person-select">Person</label>
            <select id="person-select" value={newItem.person || ""} onChange={(e) => setNewItem({ ...newItem, person: e.target.value === "Select Person" ? "" : e.target.value === "Family" ? "" : e.target.value })}> 
              {personOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="value-input">Value</label>
            <input
              id="value-input"
              type="number"
              placeholder="Value"
              value={newItem.value}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="frequency-select">Frequency</label>
            <select id="frequency-select" value={newItem.frequency} onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value })}>
              <option value="">Select Frequency</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="form-field date-field-group">
            <div className="date-field">
              <label htmlFor="start-date-input">Start Date</label>
              <input
                id="start-date-input"
                type="date"
                placeholder="Start Date"
                value={newItem.start_date}
                onChange={(e) => setNewItem({ ...newItem, start_date: e.target.value })}
              />
            </div>

            <div className="date-field">
              <label htmlFor="end-date-input">End Date</label>
              <input
                id="end-date-input"
                type="date"
                placeholder="End Date"
                value={newItem.end_date || ""}
                onChange={(e) => setNewItem({ ...newItem, end_date: e.target.value })}
              />
            </div>
          </div>

          {type === "income" && (
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

          {type === "income" && (
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

          {/* Inflation % field for expenses */}
          {type === "expense" && (
            <div className="form-field">
              <label htmlFor="inflation-percent">Inflation %</label>
              <input
                id="inflation-percent"
                type="number"
                step="0.1"
                placeholder="Inflation %"
                value={newItem.inflation_percent}
                onChange={(e) => setNewItem({ ...newItem, inflation_percent: e.target.value })}
              />
            </div>
          )}

          {type === "expense" && (
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
            <button onClick={save} id="add-cashflow-item-button">
              {itemToEdit ? "Update" : "Add"}
            </button>
            <button onClick={cancelEdit} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
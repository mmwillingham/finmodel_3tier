import React, { useState, useEffect } from "react";
import LiabilityService from "../services/liability.service";
import SettingsService from "../services/settings.service";
import Modal from "./Modal"; // Import the generic Modal component
import "./LiabilityFormModal.css"; // Specific styling for this form

export default function LiabilityFormModal({
  isOpen,
  onClose,
  item: itemToEdit,
  onSaveSuccess,
}) {
  const [categories, setCategories] = useState([]);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "Other", // Default category for liabilities
    value: "",
    annual_increase_percent: 0,
    annual_change_type: "increase", // Default to increase for liabilities
    loan_type: "ordinary", // NEW: Default loan type
    principal_amount: "", // NEW
    interest_rate: "", // NEW
    loan_term_months: "", // NEW
    loan_start_date: "", // NEW
    fees: 0, // NEW: Default fees
    monthly_payment: "", // NEW (though calculated by backend for amortized)
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await SettingsService.getSettings();
        const cats = res.data.liability_categories?.split(",") || ["Other"];
        setCategories(cats);

        if (itemToEdit) {
          setNewItem({
            name: itemToEdit.name || '',
            category: itemToEdit.category || '',
            value: itemToEdit.value.toString() || '',
            annual_increase_percent: itemToEdit.annual_increase_percent || 0,
            annual_change_type: itemToEdit.annual_change_type || "increase",
            loan_type: itemToEdit.loan_type || "ordinary", // NEW
            principal_amount: itemToEdit.principal_amount?.toString() || "", // NEW
            interest_rate: itemToEdit.interest_rate?.toString() || "", // NEW
            loan_term_months: itemToEdit.loan_term_months?.toString() || "", // NEW
            loan_start_date: itemToEdit.loan_start_date?.split("T")[0] || "", // NEW
            monthly_payment: itemToEdit.monthly_payment?.toString() || "", // NEW
            fees: itemToEdit.fees?.toString() || 0, // NEW
            start_date: itemToEdit.start_date || '',
            end_date: itemToEdit.end_date || '',
          });
        } else {
          setNewItem(prev => ({
            ...prev,
            name: "",
            category: cats[0] || "Other", // Ensure default category for new items
            value: "",
            annual_increase_percent: 0,
            annual_change_type: "increase",
            loan_type: "ordinary", // NEW
            principal_amount: "", // NEW
            interest_rate: "", // NEW
            loan_term_months: "", // NEW
            loan_start_date: "", // NEW
            monthly_payment: "", // NEW
            fees: 0, // NEW
            start_date: "",
            end_date: "",
          }));
        }
      } catch (e) {
        console.error("Failed to load settings", e);
        setCategories(["Other"]);
        if (!itemToEdit) {
          setNewItem(prev => ({ ...prev, category: "Other", annual_change_type: "increase" }));
        }
      }
    };
    loadSettings();
  }, [itemToEdit]);

  const save = async () => {
    // Validation adjusted based on loan type
    if (!newItem.name || !newItem.category) return; // Basic validation

    const payload = {
      name: newItem.name,
      category: newItem.category,
      value: newItem.loan_type === "ordinary" ? parseFloat(newItem.value) : 0, // Only send value for ordinary loans
      annual_increase_percent: newItem.loan_type === "ordinary" ? parseFloat(newItem.annual_increase_percent || 0) : 0, // Only send for ordinary
      annual_change_type: newItem.loan_type === "ordinary" ? newItem.annual_change_type : "increase", // Default for amortized, or as specified for ordinary
      loan_type: newItem.loan_type,
      principal_amount: newItem.loan_type === "amortized" && newItem.principal_amount ? parseFloat(newItem.principal_amount) : null,
      interest_rate: newItem.loan_type === "amortized" && newItem.interest_rate ? parseFloat(newItem.interest_rate) : null,
      loan_term_months: newItem.loan_type === "amortized" && newItem.loan_term_months ? parseInt(newItem.loan_term_months, 10) : null,
      loan_start_date: newItem.loan_type === "amortized" && newItem.loan_start_date ? newItem.loan_start_date : null,
      monthly_payment: newItem.loan_type === "amortized" && newItem.monthly_payment ? parseFloat(newItem.monthly_payment) : null, // Backend calculates, but can be sent if present
      fees: newItem.loan_type === "amortized" && newItem.fees ? parseFloat(newItem.fees) : 0,
      start_date: newItem.loan_type === "ordinary" && newItem.start_date ? newItem.start_date : null,
      end_date: null, // Always null for both loan types as it's not needed
    };

    try {
      if (itemToEdit) {
        await LiabilityService.update(itemToEdit.id, payload);
      } else {
        await LiabilityService.create(payload);
      }
      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save liability item:", error);
      // Optionally, show an error message to the user
    }
  };

  const cancelEdit = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.name} (${newItem.loan_type === 'amortized' ? 'Amortized Loan' : 'Ordinary/Revolving'})` : `Add New Liability`}>
      <div className="liability-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}> {/* Loan Type, Name, Category */}
            <div className="form-field">
              <label htmlFor="loan-type">Loan Type</label>
              <select id="loan-type" value={newItem.loan_type} onChange={(e) => setNewItem({ ...newItem, loan_type: e.target.value })}>
                <option value="ordinary">Ordinary/Revolving</option>
                <option value="amortized">Amortized Loan</option>
              </select>
            </div>
            {/* Name and Category are common for both types */}
            <div className="form-field">
              <label htmlFor="liability-name">Name</label>
              <input
                id="liability-name"
                type="text"
                placeholder="Name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="liability-category">Category</label>
              <select id="liability-category" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {newItem.loan_type === "ordinary" && (
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}> {/* Fields specific to Ordinary/Revolving loan */}
              <div className="form-field">
                <label htmlFor="liability-value">Value</label>
                <input
                  id="liability-value"
                  type="number"
                  placeholder="Value"
                  value={newItem.value}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label htmlFor="annual-change-percent">Annual Increase Percent</label>
                <input
                  id="annual-change-percent"
                  type="number"
                  step="0.1"
                  placeholder="Percent"
                  value={newItem.annual_increase_percent}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, annual_increase_percent: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label htmlFor="liability-start-date">Start Date</label>
                <input
                  id="liability-start-date"
                  type="date"
                  placeholder="Start Date"
                  value={newItem.start_date}
                  onChange={(e) => setNewItem({ ...newItem, start_date: e.target.value })}
                />
              </div>
            </div>
          )}

          {newItem.loan_type === "amortized" && (
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}> {/* Fields specific to Amortized loan */}
              <div className="form-field">
                <label htmlFor="principal-amount">Principal Amount</label>
                <input
                  id="principal-amount"
                  type="number"
                  step="0.01"
                  placeholder="Principal Amount"
                  value={newItem.principal_amount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, principal_amount: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="interest-rate">Annual Interest Rate (%)</label>
                <input
                  id="interest-rate"
                  type="number"
                  step="0.01"
                  placeholder="Annual Interest Rate"
                  value={newItem.interest_rate}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, interest_rate: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="loan-term-months">Loan Term (Months)</label>
                <input
                  id="loan-term-months"
                  type="number"
                  step="1"
                  placeholder="Loan Term (Months)"
                  value={newItem.loan_term_months}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, loan_term_months: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="loan-start-date">Loan Start Date</label>
                <input
                  id="loan-start-date"
                  type="date"
                  value={newItem.loan_start_date}
                  onChange={(e) => setNewItem({ ...newItem, loan_start_date: e.target.value })}
                />
              </div>
            </div>
          )}
          {newItem.loan_type === "amortized" && newItem.monthly_payment && (
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="form-field">
                <label>Est. Monthly Payment</label>
                <input type="text" value={parseFloat(newItem.monthly_payment).toFixed(2)} readOnly disabled />
              </div>
              <div className="form-field">
                <label htmlFor="fees">Fees (One-time)</label>
                <input
                  id="fees"
                  type="number"
                  step="0.01"
                  placeholder="Fees"
                  value={newItem.fees}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, fees: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button onClick={save} id="add-liability-item-button">
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
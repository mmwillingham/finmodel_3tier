import React, { useState, useEffect } from "react";
import LiabilityService from "../services/liability.service";
import SettingsService from "../services/settings.service";
import Modal from "./Modal"; // Import the generic Modal component
import "./LiabilityFormModal.css"; // Specific styling for this form

const initialNewItemState = {
  name: "",
  category: "Other", // Default category for liabilities
  value: "",
  annual_increase_percent: 0,
  annual_change_type: "increase", // Default to increase for liabilities
  loan_type: "ordinary", // NEW: Default loan type
  principal_amount: null, // NEW: Changed from "" to null
  interest_rate: null, // NEW: Changed from "" to null
  loan_term_months: null, // NEW: Changed from "" to null
  loan_start_date: null, // NEW: Changed from "" to null
  fees: null, // NEW: Default fees to null for optional float
  monthly_payment: null, // NEW: Changed from "" to null
  start_date: "",
  end_date: "",
};

export default function LiabilityFormModal({
  isOpen,
  onClose,
  item: itemToEdit,
  onSaveSuccess,
}) {
  const [categories, setCategories] = useState([]);
  const [newItem, setNewItem] = useState(initialNewItemState); // Initialize with initialState

  useEffect(() => {
    const loadSettingsAndSetItem = async () => {
      try {
        const res = await SettingsService.getSettings();
        const cats = res.data.liability_categories || ["Other"];
        setCategories(cats);

        if (isOpen) { // Only reset or load when modal is actually open
            if (itemToEdit) {
                // If editing, populate with existing item data
                console.log("Loading item to edit:", itemToEdit);
                setNewItem({
                    name: itemToEdit.name || '',
                    category: itemToEdit.category || '',
                    value: itemToEdit.value?.toString() || '', // Use nullish coalescing
                    annual_increase_percent: itemToEdit.annual_increase_percent ?? 0,
                    annual_change_type: itemToEdit.annual_change_type || "increase",
                    loan_type: itemToEdit.loan_type || "ordinary",
                    principal_amount: itemToEdit.principal_amount?.toString() || "",
                    interest_rate: itemToEdit.interest_rate?.toString() || "",
                    loan_term_months: itemToEdit.loan_term_months?.toString() || "",
                    loan_start_date: itemToEdit.loan_start_date?.split("T")[0] || "",
                    monthly_payment: itemToEdit.monthly_payment?.toString() || "",
                    fees: itemToEdit.fees != null ? itemToEdit.fees.toString() : "", // Changed from "0" to ""
                    start_date: itemToEdit.start_date || '',
                    end_date: itemToEdit.end_date || '',
                });
            } else {
                // If adding a new item, reset to initial state and set default category
                console.log("Resetting form for new liability.");
                setNewItem(prev => ({
                    ...initialNewItemState,
                    category: cats[0] || "Other",
                }));
            }
        }

      } catch (e) {
        console.error("Failed to load settings", e);
        setCategories(["Other"]);
        if (!itemToEdit) {
          setNewItem(prev => ({ ...initialNewItemState, category: "Other" }));
        }
      }
    };

    loadSettingsAndSetItem();
  }, [isOpen, itemToEdit]); // Dependencies changed to include isOpen and itemToEdit

  const save = async () => {
    // Validation adjusted based on loan type
    if (!newItem.name || !newItem.category) {
      alert("Name and Category are required.");
      return;
    }

    if (newItem.loan_type === "amortized") {
      if (!newItem.principal_amount || isNaN(parseFloat(newItem.principal_amount))) {
        alert("Principal Amount is required and must be a number for amortized loans.");
        return;
      }
      if (!newItem.interest_rate || isNaN(parseFloat(newItem.interest_rate))) {
        alert("Annual Interest Rate is required and must be a number for amortized loans.");
        return;
      }
      if (!newItem.loan_term_months || isNaN(parseInt(newItem.loan_term_months, 10))) {
        alert("Loan Term (Months) is required and must be an integer for amortized loans.");
        return;
      }
      if (!newItem.loan_start_date) {
        alert("Loan Start Date is required for amortized loans.");
        return;
      }
    } else { // Ordinary loan validation
        if (!newItem.value || isNaN(parseFloat(newItem.value))) {
            alert("Value is required and must be a number for ordinary loans.");
            return;
        }
        if (isNaN(parseFloat(newItem.annual_increase_percent))) {
            alert("Annual Increase Percent must be a number for ordinary loans.");
            return;
        }
    }

    const payload = {
      name: newItem.name,
      category: newItem.category,
      value: newItem.loan_type === "ordinary" && newItem.value !== "" ? parseFloat(newItem.value) : 0, // Only send value for ordinary loans
      annual_increase_percent: newItem.loan_type === "ordinary" && newItem.annual_increase_percent !== "" ? parseFloat(newItem.annual_increase_percent) : 0, // Only send for ordinary
      annual_change_type: newItem.loan_type === "ordinary" ? newItem.annual_change_type : "increase", // Default for amortized, or as specified for ordinary
      loan_type: newItem.loan_type,
      principal_amount: newItem.loan_type === "amortized" && newItem.principal_amount !== "" ? parseFloat(newItem.principal_amount) : null,
      interest_rate: newItem.loan_type === "amortized" && newItem.interest_rate !== "" ? parseFloat(newItem.interest_rate) : null,
      loan_term_months: newItem.loan_type === "amortized" && newItem.loan_term_months !== "" ? parseInt(newItem.loan_term_months, 10) : null,
      loan_start_date: newItem.loan_type === "amortized" && newItem.loan_start_date !== "" ? newItem.loan_start_date : null,
      monthly_payment: newItem.loan_type === "amortized" && newItem.monthly_payment !== "" ? parseFloat(newItem.monthly_payment) : null,
      fees: newItem.loan_type === "amortized" && newItem.fees !== "" ? parseFloat(newItem.fees) : null, // NEW: Send null if empty string
      start_date: newItem.loan_type === "ordinary" && newItem.start_date !== "" ? newItem.start_date : null,
      end_date: null,
    };

    try {
      console.log("Attempting to save liability with payload:", payload); // NEW: More detailed logging
      if (itemToEdit) {
        await LiabilityService.update(itemToEdit.id, payload);
        console.log("Liability updated successfully."); // New log
      } else {
        await LiabilityService.create(payload);
        console.log("Liability created successfully."); // New log
      }
      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save liability item. Full error object:", error); // Improved logging
      alert(`Failed to save liability: ${error.response?.data?.detail || error.message}`);
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
                <label htmlFor="annual-change-percent">Annual Interest Rate (%)</label> {/* Renamed label */}
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
          {newItem.loan_type === "amortized" && (
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="form-field">
                <label htmlFor="monthly-payment">Est. Monthly Payment</label>
                <input
                  id="monthly-payment"
                  type="number"
                  step="0.01"
                  placeholder="Monthly Payment"
                  value={newItem.monthly_payment}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, monthly_payment: e.target.value })}
                />
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
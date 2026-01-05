import React, { useState, useEffect } from "react";
import LiabilityService from "../services/liability.service";
import SettingsService from "../services/settings.service";
import Modal from "./Modal"; // Import the generic Modal component
import "./LiabilityFormModal.css"; // Specific styling for this form

// Helper function to calculate monthly payment for an amortized loan
const calculateAmortizedMonthlyPayment = (principal, annualInterestRatePercent, loanTermMonths) => {
  if (principal <= 0 || annualInterestRatePercent < 0 || loanTermMonths <= 0) {
    return 0; // Invalid input
  }

  const monthlyInterestRate = (annualInterestRatePercent / 100) / 12;

  if (monthlyInterestRate === 0) {
    return principal / loanTermMonths;
  }

  const monthlyPayment =
    (principal * monthlyInterestRate) /
    (1 - Math.pow(1 + monthlyInterestRate, -loanTermMonths));

  return monthlyPayment;
};

const initialNewItemState = {
  name: "",
  category: "Other", // Default category for liabilities
  value: "",
  annual_increase_percent: 0,
  annual_change_type: "increase", // Default to increase for liabilities
  loan_type: "ordinary", // NEW: Default loan type
  principal_amount: "", // Changed from null to empty string for input fields
  interest_rate: "", // Changed from null to empty string for input fields
  loan_term_months: "", // Changed from null to empty string for input fields
  loan_start_date: "",
  monthly_payment: "", // Changed from null to empty string, will be calculated
  start_date: "",
  end_date: "",
  decrease_by_principal_yearly: false, // NEW
  create_payment_expense: false, // NEW
  expense_category: "", // NEW: Category for the generated expense
};

export default function LiabilityFormModal({
  isOpen,
  onClose,
  item: itemToEdit,
  onSaveSuccess,
}) {
  const [categories, setCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [newItem, setNewItem] = useState(initialNewItemState); // Initialize with initialState

  // Effect to load settings and populate item for editing or reset for new item
  useEffect(() => {
    const loadSettingsAndSetItem = async () => {
      try {
        const res = await SettingsService.getSettings();
        const cats = res.data.liability_categories || ["Other"];
        setCategories(cats);
        const expCats = res.data.expense_categories || ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setExpenseCategories(expCats);

        if (isOpen) {
        if (itemToEdit) {
          // If editing, populate with existing item data
            console.log("Loading item to edit:", itemToEdit);
          setNewItem({
            name: itemToEdit.name || '',
            category: itemToEdit.category || '',
              value: itemToEdit.value?.toString() || '',
              annual_increase_percent: itemToEdit.annual_increase_percent ?? 0,
            annual_change_type: itemToEdit.annual_change_type || "increase",
            loan_type: itemToEdit.loan_type || "ordinary",
            principal_amount: itemToEdit.principal_amount?.toString() || "",
            interest_rate: itemToEdit.interest_rate?.toString() || "",
            loan_term_months: itemToEdit.loan_term_months?.toString() || "",
            loan_start_date: itemToEdit.loan_start_date?.split("T")[0] || "",
              // Use the actual monthly_payment from itemToEdit, or calculate if not present
            monthly_payment: itemToEdit.monthly_payment?.toString() || "",
            start_date: itemToEdit.start_date || '',
            end_date: itemToEdit.end_date || '',
            decrease_by_principal_yearly: itemToEdit.decrease_by_principal_yearly || false,
            create_payment_expense: itemToEdit.create_payment_expense || false,
            expense_category: itemToEdit.expense_category || "",
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
  }, [isOpen, itemToEdit]);

  // Effect to calculate monthly payment for amortized loans
  useEffect(() => {
    if (newItem.loan_type === "amortized") {
      const principal = parseFloat(newItem.principal_amount);
      const interestRate = parseFloat(newItem.interest_rate);
      const loanTerm = parseInt(newItem.loan_term_months, 10);

      if (!isNaN(principal) && !isNaN(interestRate) && !isNaN(loanTerm) && loanTerm > 0) {
        const calculatedPayment = calculateAmortizedMonthlyPayment(
          principal,
          interestRate,
          loanTerm
        );
        setNewItem(prev => ({
          ...prev,
          monthly_payment: calculatedPayment.toFixed(2), // Set calculated payment, rounded to 2 decimal places
        }));
    } else {
        // If inputs are incomplete or invalid, clear monthly payment
        setNewItem(prev => ({ ...prev, monthly_payment: "" }));
      }
    }
  }, [newItem.principal_amount, newItem.interest_rate, newItem.loan_term_months, newItem.loan_type]);


  const save = async () => {
    // Validation adjusted based on loan type
    if (!newItem.name || !newItem.category) {
      alert("Name and Category are required.");
      return;
    }

    const payload = {
      name: newItem.name,
      category: newItem.category,
      annual_change_type: "increase", // Default for both, or can be managed
    };

    if (newItem.loan_type === "amortized") {
      // Validate expense_category if create_payment_expense is checked
      if (newItem.create_payment_expense && !newItem.expense_category) {
        alert("Expense Category is required when 'Create corresponding expense for payment amount' is checked.");
        return;
      }
      
      const principal = parseFloat(newItem.principal_amount);
      const interestRate = parseFloat(newItem.interest_rate);
      const loanTerm = parseInt(newItem.loan_term_months, 10);
      const monthlyPayment = parseFloat(newItem.monthly_payment);

      if (isNaN(principal) || principal <= 0) {
        alert("Principal Amount is required and must be a positive number for amortized loans.");
        return;
      }
      if (isNaN(interestRate) || interestRate < 0) {
        alert("Annual Interest Rate is required and must be a non-negative number for amortized loans.");
        return;
      }
      if (isNaN(loanTerm) || loanTerm <= 0) {
        alert("Loan Term (Months) is required and must be a positive integer for amortized loans.");
        return;
      }
      if (!newItem.loan_start_date) {
        alert("Loan Start Date is required for amortized loans.");
        return;
      }
      // Ensure monthly_payment is also valid, it should be calculated
      if (isNaN(monthlyPayment) || monthlyPayment <= 0) {
        alert("Monthly Payment is required and must be a positive number for amortized loans.");
        return;
      }

      Object.assign(payload, {
        loan_type: "amortized",
        value: principal, // Store principal as value for consistency in some views
        principal_amount: principal,
        interest_rate: interestRate,
        loan_term_months: loanTerm,
        loan_start_date: newItem.loan_start_date,
        monthly_payment: monthlyPayment,
        annual_increase_percent: 0, // Amortized loans don't have this, or it's handled differently
        start_date: null, // Clear these for amortized loans
        end_date: null,
        decrease_by_principal_yearly: newItem.decrease_by_principal_yearly || false,
        create_payment_expense: newItem.create_payment_expense || false,
        expense_category: newItem.expense_category || null,
      });
    } else { // Ordinary loan validation and payload construction
      const value = parseFloat(newItem.value);
      const annualIncreasePercent = parseFloat(newItem.annual_increase_percent);

      if (isNaN(value) || value <= 0) {
        alert("Value is required and must be a positive number for ordinary loans.");
            return;
        }
      if (isNaN(annualIncreasePercent)) {
            alert("Annual Increase Percent must be a number for ordinary loans.");
            return;
        }

      Object.assign(payload, {
        loan_type: "ordinary",
        value: value,
        annual_increase_percent: annualIncreasePercent,
        annual_change_type: newItem.annual_change_type,
        start_date: newItem.start_date || null,
        end_date: newItem.end_date || null,
        // Clear amortized specific fields
        principal_amount: null,
        interest_rate: null,
        loan_term_months: null,
        loan_start_date: null,
        monthly_payment: null,
      });
    }

    try {
      console.log("Attempting to save liability with payload:", payload);
      if (itemToEdit) {
        await LiabilityService.update(itemToEdit.id, payload);
        console.log("Liability updated successfully.");
      } else {
        await LiabilityService.create(payload);
        console.log("Liability created successfully.");
      }
      onSaveSuccess();
    } catch (error) {
      console.error("Failed to save liability item. Full error object:", error);
      alert(`Failed to save liability: ${error.response?.data?.detail || error.message}`);
    }
  };

  const cancelEdit = () => {
    onClose();
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setNewItem(prev => ({ ...prev, [id]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.name} (${newItem.loan_type === 'amortized' ? 'Amortized Loan' : 'Ordinary/Revolving'})` : `Add New Liability`}>
      <div className="liability-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}> {/* Loan Type, Name, Category */}
            <div className="form-field">
              <label htmlFor="loan_type">Loan Type</label>
              <select id="loan_type" value={newItem.loan_type} onChange={handleInputChange}>
                <option value="ordinary">Ordinary/Revolving</option>
                <option value="amortized">Amortized Loan</option>
              </select>
            </div>
            {/* Name and Category are common for both types */}
            <div className="form-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                placeholder="Name"
                value={newItem.name}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-field">
              <label htmlFor="category">Category</label>
              <select id="category" value={newItem.category} onChange={handleInputChange}>
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
                <label htmlFor="value">Value</label>
                <input
                  id="value"
                  type="number"
                  placeholder="Value"
                  value={newItem.value}
                  onFocus={(e) => e.target.select()}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-field">
                <label htmlFor="annual_increase_percent">Annual Interest Rate (%)</label> {/* Renamed label */}
                <input
                  id="annual_increase_percent"
                  type="number"
                  step="0.1"
                  placeholder="Percent"
                  value={newItem.annual_increase_percent}
                  onFocus={(e) => e.target.select()}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-field">
                <label htmlFor="start_date">Start Date</label>
                <input
                  id="start_date"
                  type="date"
                  placeholder="Start Date"
                  value={newItem.start_date}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          {newItem.loan_type === "amortized" && (
            <>
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}> {/* Fields specific to Amortized loan */}
              <div className="form-field">
                  <label htmlFor="principal_amount">Principal Amount</label>
                <input
                    id="principal_amount"
                  type="number"
                  step="0.01"
                  placeholder="Principal Amount"
                  value={newItem.principal_amount}
                  onFocus={(e) => e.target.select()}
                    onChange={handleInputChange}
                />
              </div>
              <div className="form-field">
                  <label htmlFor="interest_rate">Annual Interest Rate (%)</label>
                <input
                    id="interest_rate"
                  type="number"
                  step="0.01"
                  placeholder="Annual Interest Rate"
                  value={newItem.interest_rate}
                  onFocus={(e) => e.target.select()}
                    onChange={handleInputChange}
                />
              </div>
              <div className="form-field">
                  <label htmlFor="loan_term_months">Loan Term (Months)</label>
                <input
                    id="loan_term_months"
                  type="number"
                  step="1"
                  placeholder="Loan Term (Months)"
                  value={newItem.loan_term_months}
                  onFocus={(e) => e.target.select()}
                    onChange={handleInputChange}
                />
              </div>
              <div className="form-field">
                  <label htmlFor="loan_start_date">Loan Start Date</label>
                <input
                    id="loan_start_date"
                  type="date"
                  value={newItem.loan_start_date}
                    onChange={handleInputChange}
                />
              </div>
              </div>
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(1, 1fr)' }}>
              <div className="form-field">
                  <label htmlFor="monthly_payment">Calculated Monthly Payment</label>
                <input
                    id="monthly_payment"
                  type="number"
                  step="0.01"
                    value={newItem.monthly_payment}
                    readOnly // Make this field read-only
                    tabIndex="-1" // Make it not focusable via tab
                    style={{ backgroundColor: '#e9ecef', cursor: 'not-allowed' }} // Style to indicate read-only
                />
              </div>
            </div>
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: '15px' }}>
              <div className="form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={newItem.decrease_by_principal_yearly || false}
                    onChange={(e) => setNewItem({ ...newItem, decrease_by_principal_yearly: e.target.checked })}
                  />
                  Decrease liability by principal amount each year
                </label>
              </div>
              <div className="form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={newItem.create_payment_expense || false}
                    onChange={(e) => setNewItem({ ...newItem, create_payment_expense: e.target.checked })}
                  />
                  Create corresponding expense for payment amount
                </label>
              </div>
              {newItem.create_payment_expense && (
                <div className="form-field">
                  <label>
                    Expense Category: *
                    <select
                      value={newItem.expense_category || ""}
                      onChange={(e) => setNewItem({ ...newItem, expense_category: e.target.value })}
                      required
                    >
                      <option value="">Select Category</option>
                      {expenseCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
            </>
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

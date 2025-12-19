import React, { useState, useEffect } from "react";
import CashFlowService from "../services/cashflow.service";
import SettingsService from "../services/settings.service";
import AssetService from "../services/asset.service"; // New import
import LiabilityService from "../services/liability.service"; // New import
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
  const [isDynamic, setIsDynamic] = useState(false); // New state for dynamic item
  const [linkedItemType, setLinkedItemType] = useState(""); // New state for linked item type
  const [linkedItemId, setLinkedItemId] = useState(null); // New state for linked item ID
  const [percentage, setPercentage] = useState(""); // New state for percentage
  const [availableLinkedItems, setAvailableLinkedItems] = useState({
    assets: [],
    liabilities: [],
    income: [],
    expenses: [],
  }); // New state for fetching available linked items

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

  // Effect for loading settings and initializing form fields
  useEffect(() => {
    const loadSettingsAndItem = async () => {
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
        }
        setPersonOptions(newPersonOptions);

        // --- Initialize form data based on itemToEdit or defaults ---
        if (itemToEdit) {
          const displayValue = itemToEdit.frequency === 'monthly'
            ? (itemToEdit.yearly_value / 12).toString()
            : itemToEdit.yearly_value.toString();

          setNewItem({
            category: itemToEdit.category || '',
            description: itemToEdit.description || '',
            value: displayValue, // This will be ignored if isDynamic is true
            frequency: itemToEdit.frequency || '',
            annual_increase_percent: itemToEdit.annual_increase_percent || 0,
            inflation_percent: itemToEdit.inflation_percent || inflation,
            person: itemToEdit.person || '',
            start_date: itemToEdit.start_date || '',
            end_date: itemToEdit.end_date || '',
            taxable: itemToEdit.taxable || false,
            tax_deductible: itemToEdit.tax_deductible || false,
          });
          // Initialize dynamic fields if present in itemToEdit
          setIsDynamic(!!itemToEdit.linked_item_id); // Set to true if linked_item_id exists
          setLinkedItemType(itemToEdit.linked_item_type || "");
          setLinkedItemId(itemToEdit.linked_item_id || null);
          setPercentage(itemToEdit.percentage !== null ? itemToEdit.percentage.toString() : "");

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
            taxable: true, // Default to true for new income items
            tax_deductible: false,
          }));
          // Reset dynamic fields for new item
          setIsDynamic(false);
          setLinkedItemType("");
          setLinkedItemId(null);
          setPercentage("");
        }
      } catch (e) {
        console.error("Failed to load settings or item", e);
        const defaultCategories = type === "income"
          ? ["Salary", "Bonus", "Investment Income", "Other"]
          : ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(defaultCategories);
        setPersonOptions(["Select Person", "Person 1", "Person 2"]);
        if (!itemToEdit) {
          setNewItem(prev => ({ ...prev, category: "", person: "", frequency: "", inflation_percent: 0 }));
        }
        setIsDynamic(false);
        setLinkedItemType("");
        setLinkedItemId(null);
        setPercentage("");
      }
    };
    loadSettingsAndItem();
  }, [itemToEdit, type]);

  // Effect for fetching all potential linked items
  useEffect(() => {
    if (isOpen) { // Only fetch when modal is open
      const fetchLinkedItems = async () => {
        try {
          const assetsRes = await AssetService.list();
          const liabilitiesRes = await LiabilityService.list();
          const incomeRes = await CashFlowService.list(true);
          const expensesRes = await CashFlowService.list(false);

          setAvailableLinkedItems({
            assets: assetsRes.data,
            liabilities: liabilitiesRes.data,
            income: incomeRes.data,
            expenses: expensesRes.data,
          });
        } catch (error) {
          console.error("Failed to fetch linked items:", error);
        }
      };
      fetchLinkedItems();
    }
  }, [isOpen]); // Only re-run when modal opens/closes

  const save = async () => {
    if (!newItem.category || !newItem.description) return; // Value can be dynamic or 0

    // Validation for dynamic items
    if (isDynamic) {
      if (!linkedItemType || !linkedItemId || percentage === "" || isNaN(parseFloat(percentage))) {
        alert("Please select a linked item type, an item, and enter a valid percentage.");
        return;
      }
    } else if (newItem.value === "" || isNaN(parseFloat(newItem.value))) {
      // Regular item validation
      alert("Please enter a valid value.");
      return;
    }

    const payload = {
      is_income: type === "income",
      category: newItem.category,
      description: newItem.description,
      frequency: newItem.frequency || "yearly", // Fallback if empty
      // Value handling: if dynamic, send 0 or null; backend will calculate. Otherwise, send parsed value.
      value: isDynamic ? 0.0 : parseFloat(newItem.value),
      annual_increase_percent: type === "income" ? parseFloat(newItem.annual_increase_percent || 0) : 0,
      inflation_percent: type === "expense" ? parseFloat(newItem.inflation_percent || defaultInflation) : 0,
      person: newItem.person === "Select Person" || newItem.person === "Family" ? null : newItem.person || null,
      start_date: newItem.start_date || null,
      end_date: newItem.end_date || null,
      taxable: type === "income" ? newItem.taxable : false,
      tax_deductible: type === "expense" ? newItem.tax_deductible : false,
      // Dynamic fields
      linked_item_id: isDynamic ? linkedItemId : null,
      linked_item_type: isDynamic ? linkedItemType : null,
      percentage: isDynamic ? parseFloat(percentage) : null,
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
      alert(`Failed to save item: ${error.response?.data?.detail || error.message}`);
    }
  };

  const cancelEdit = () => {
    onClose(); // Just close the modal on cancel
  };

  // Helper to get linked item options based on selected type
    const getLinkedItemOptions = () => {
    console.log("Current linkedItemType:", linkedItemType);
    const lowerCaseType = linkedItemType.toLowerCase();
    console.log("Lowercase linkedItemType:", lowerCaseType);
    const typeToKeyMap = {
      "asset": "assets",
      "liability": "liabilities",
      "income": "income",
      "expense": "expenses"
    };
    const key = typeToKeyMap[lowerCaseType];
    const items = availableLinkedItems[key];
    if (!items) return [];
    // For cash flow items, filter out the item being edited to prevent self-linking
    return items.filter(item => !(itemToEdit && item.id === itemToEdit.id)).map(item => ({
      id: item.id,
      name: item.name || item.description, // Assets/Liabilities have name, CashFlowItems have description
      category: item.category,
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.description}` : `Add New ${type === 'income' ? 'Income' : 'Expense'} Item`}>
      <div className="cashflow-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}> {/* First row: Person, Description, Category, Value, Frequency */} 
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
              <label htmlFor="value-input">Value</label>
              <input
                id="value-input"
                type="number"
                placeholder={isDynamic ? "Calculated Dynamically" : "Value"}
                value={isDynamic ? "" : newItem.value}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                disabled={isDynamic}
              />
            </div>

            <div className="form-field">
              <label htmlFor="frequency-select">Frequency</label>
              <select id="frequency-select" value={newItem.frequency} onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value })} disabled={isDynamic}> 
                <option value="">Select Frequency</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* New row for dynamic item configuration */}
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="form-field">
              <label htmlFor="is-dynamic-select">Dynamic</label>
              <select
                id="is-dynamic-select"
                value={isDynamic ? "Yes" : "No"}
                onChange={(e) => {
                  const newIsDynamic = e.target.value === "Yes";
                  setIsDynamic(newIsDynamic);
                  // Reset linked item fields when toggling dynamic status
                  setLinkedItemType("");
                  setLinkedItemId(null);
                  setPercentage("");
                  // If switching from dynamic to non-dynamic, re-enable value/frequency
                  if (!newIsDynamic && !itemToEdit) {
                    setNewItem(prev => ({...prev, value: "", frequency: ""}));
                  }
                }}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {isDynamic && (
              <> 
                <div className="form-field">
                  <label htmlFor="linked-item-type-select">Linked Item Type</label>
                  <select
                    id="linked-item-type-select"
                    value={linkedItemType}
                    onChange={(e) => { setLinkedItemType(e.target.value); setLinkedItemId(null); /* Reset linked item on type change */ }}
                  >
                    <option value="">Select Type</option>
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="linked-item-select">Linked Item</label>
                  <select
                    id="linked-item-select"
                    value={linkedItemId || ""}
                    onChange={(e) => setLinkedItemId(parseInt(e.target.value))}
                    disabled={!linkedItemType}
                  >
                    <option value="">Select Item</option>
                    {getLinkedItemOptions().map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="percentage-input">Percentage (%)</label>
                  <input
                    id="percentage-input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Percentage"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) minmax(0, 1fr)' }}> {/* Second row (original): Annual Increase %, Start Date, End Date, Taxable/Deductible */} 
            {type === "income" && (
              <div className="form-field">
                <label htmlFor="annual-increase">Annual Increase %</label>
                <input
                  id="annual-increase"
                  type="number"
                  step="0.1"
                  placeholder="Annual Increase %"
                  value={newItem.annual_increase_percent}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, annual_increase_percent: e.target.value })}
                  disabled={isDynamic} // Disable if dynamic
                />
              </div>
            )}

            {type === "expense" && (
              <div className="form-field">
                <label htmlFor="inflation-percent">Inflation %</label>
                <input
                  id="inflation-percent"
                  type="number"
                  step="0.1"
                  placeholder="Inflation %"
                  value={newItem.inflation_percent}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItem({ ...newItem, inflation_percent: e.target.value })}
                  disabled={isDynamic} // Disable if dynamic
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="start-date-input">Start Date</label>
              <input
                id="start-date-input"
                type="date"
                placeholder="Start Date"
                value={newItem.start_date}
                onChange={(e) => setNewItem({ ...newItem, start_date: e.target.value })}
                disabled={isDynamic} // Disable if dynamic
              />
            </div>

            <div className="form-field"> 
              <label htmlFor="end-date-input">End Date</label>
              <input
                id="end-date-input"
                type="date"
                placeholder="End Date"
                value={newItem.end_date || ""}
                onChange={(e) => setNewItem({ ...newItem, end_date: e.target.value })}
                disabled={isDynamic} // Disable if dynamic
              />
            </div>

            {(type === "income" || type === "expense") && (
              <div className="form-field"> {/* Taxable / Tax Deductible integrated into the second row */} 
                <label htmlFor={type === "income" ? "taxable-select" : "tax-deductible-select"}>
                  {type === "income" ? "Taxable" : "Tax Deductible"}
                </label>
                <select
                  id={type === "income" ? "taxable-select" : "tax-deductible-select"}
                  value={type === "income" ? (newItem.taxable ? "Yes" : "No") : (newItem.tax_deductible ? "Yes" : "No")}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      [type === "income" ? "taxable" : "tax_deductible"]: e.target.value === "Yes",
                    })
                  }
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            )}
          </div>

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
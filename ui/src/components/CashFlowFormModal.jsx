import React, { useState, useEffect, useMemo } from "react";
import CashFlowService from "../services/cashflow.service";
import SettingsService from "../services/settings.service";
import AssetService from "../services/asset.service"; // New import
import LiabilityService from "../services/liability.service"; // New import
import Modal from "./Modal"; // Import the generic Modal component
import MultiSelectCheckbox from "./MultiSelectCheckbox"; // Import the multi-select checkbox component
import { useAuth } from '../context/AuthContext';
import { calculateTaxableIncome } from '../utils/taxCalculator';
import "./CashFlowFormModal.css"; // Specific styling for this form

const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";

export default function CashFlowFormModal({
  isOpen, // From Modal component
  onClose, // From Modal component
  item: itemToEdit, // The item data if we're editing
  type, // 'income' or 'expense'
  onSaveSuccess, // Callback after successful save
  incomeItems = [], // Income items for tax calculation
  expenseItems = [], // Expense items for tax calculation
}) {
  const { userSettings } = useAuth();
  const [typeOptions, setTypeOptions] = useState([]);
  const [personOptions, setPersonOptions] = useState([]);
  const [defaultInflation, setDefaultInflation] = useState(2.0);
  const [isDynamic, setIsDynamic] = useState(false); // New state for dynamic item
  const [linkedItemType, setLinkedItemType] = useState(""); // New state for linked item type
  const [linkedItemId, setLinkedItemId] = useState(null); // New state for linked item ID
  const [linkedAssetIds, setLinkedAssetIds] = useState([]); // NEW: Array of selected asset IDs for multi-select
  const [percentage, setPercentage] = useState(""); // New state for percentage
  const [reinvestDividends, setReinvestDividends] = useState(false); // NEW: Whether to reinvest dividends
  const [reinvestmentAccountId, setReinvestmentAccountId] = useState(null); // NEW: Account ID for reinvestment
  const [isQualifiedDividend, setIsQualifiedDividend] = useState(true); // NEW: Whether dividends are qualified (defaults to true)
  const [allowValueOverwrite, setAllowValueOverwrite] = useState(false); // NEW: Whether user can overwrite the generated value (defaults to False - system controls)
  const [availableLinkedItems, setAvailableLinkedItems] = useState({
    assets: [],
    liabilities: [],
    income: [],
    expenses: [],
  }); // New state for fetching available linked items
  const [assets, setAssets] = useState([]); // NEW: Available assets for reinvestment account selection

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
    contributes_to_asset_id: null, // NEW: For expense items that contribute to an asset
    reinvest_dividends: false, // NEW: Whether to reinvest dividends
    reinvestment_account_id: null, // NEW: Account ID for reinvestment
  });

  // Effect for loading settings and initializing form fields
  useEffect(() => {
    const loadSettingsAndItem = async () => {
      try {
        const res = await SettingsService.getSettings();
        const inflation = res.data.default_inflation_percent;
        setDefaultInflation(inflation);

        const categories = type === "income"
          ? res.data.income_categories || ["Salary", "Bonus", "Investment Income", "Other"]
          : res.data.expense_categories || ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(categories);
        
        const persons = [
          res.data.person1_first_name && res.data.person1_first_name !== "Person 1" ? res.data.person1_first_name : null,
          res.data.person2_first_name && res.data.person2_first_name !== "Person 2" ? res.data.person2_first_name : null,
        ].filter(Boolean);

        // Always include "Family" as the first option, then individual persons
        let newPersonOptions = ["Family"];
        if (persons.length > 0) {
          newPersonOptions.push(...persons);
        }
        setPersonOptions(newPersonOptions);

        // --- Initialize form data based on itemToEdit or defaults ---
        if (itemToEdit) {
          const isSocialSecurityItem = itemToEdit.description?.startsWith("Social Security - ");
          const rawValue = itemToEdit.frequency === 'monthly'
            ? (itemToEdit.yearly_value / 12)
            : itemToEdit.yearly_value;
          const displayValue = isSocialSecurityItem
            ? Math.round(rawValue).toString()
            : rawValue.toString();

          // Map person: if null, use "Family", otherwise use the person name
          let mappedPerson = "Family";
          if (itemToEdit.person) {
            // Use the person name directly - it will be validated when personOptions loads
            mappedPerson = itemToEdit.person;
          }
          
          setNewItem(prev => ({
            ...prev,
            ...itemToEdit,
            value: displayValue, // This will be ignored if isDynamic is true
            person: mappedPerson, // Map null to "Family"
            annual_increase_percent: itemToEdit.annual_increase_percent ?? 0,
            inflation_percent: itemToEdit.inflation_percent ?? inflation,
            taxable: itemToEdit.taxable ?? false,
            tax_deductible: itemToEdit.tax_deductible ?? false,
            start_date: itemToEdit.start_date || "",
            end_date: itemToEdit.end_date || "",
            contributes_to_asset_id: itemToEdit.contributes_to_asset_id || null, // NEW
          }));
          // Initialize dynamic fields if present in itemToEdit
          setIsDynamic(!!(itemToEdit.linked_item_id || (itemToEdit.linked_asset_ids && itemToEdit.linked_asset_ids.length > 0))); // Set to true if linked_item_id or linked_asset_ids exists
          setLinkedItemType(itemToEdit.linked_item_type || "");
          setLinkedItemId(itemToEdit.linked_item_id || null);
          setLinkedAssetIds(itemToEdit.linked_asset_ids || []); // NEW: Initialize linked asset IDs
          setPercentage(itemToEdit.percentage !== null ? itemToEdit.percentage.toString() : "");
          setReinvestDividends(itemToEdit.reinvest_dividends || false); // NEW: Initialize dividend reinvestment
          setReinvestmentAccountId(itemToEdit.reinvestment_account_id || null); // NEW: Initialize reinvestment account
          setIsQualifiedDividend(itemToEdit.is_qualified_dividend !== undefined ? itemToEdit.is_qualified_dividend : true); // NEW: Initialize qualified dividend (default to true)
          // For Social Security items, always default to false (system controls) regardless of database value
          const isSocialSecurity = itemToEdit.description?.startsWith("Social Security - ");
          setAllowValueOverwrite(isSocialSecurity ? false : (itemToEdit.allow_value_overwrite !== undefined ? itemToEdit.allow_value_overwrite : false)); // NEW: Initialize allow value overwrite (default to false - system controls by default)

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
            person: "Family",
            start_date: "",
            end_date: "",
            taxable: true, // Default to true for new income items
            tax_deductible: false,
            contributes_to_asset_id: null, // NEW
          }));
          // Reset dynamic fields for new item
          setIsDynamic(false);
          setLinkedItemType("");
          setLinkedItemId(null);
          setLinkedAssetIds([]); // NEW: Reset linked asset IDs
          setPercentage("");
          setReinvestDividends(false); // NEW: Reset dividend reinvestment
          setReinvestmentAccountId(null); // NEW: Reset reinvestment account
          setIsQualifiedDividend(true); // NEW: Reset qualified dividend (default to true)
          setAllowValueOverwrite(false); // NEW: Reset allow value overwrite (default to false - system controls)
        }
      } catch (e) {
        console.error("Failed to load settings or item", e);
        const defaultCategories = type === "income"
          ? ["Salary", "Bonus", "Investment Income", "Other"]
          : ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(defaultCategories);
        setPersonOptions(["Family", "Person 1", "Person 2"]);
        if (!itemToEdit) {
          setNewItem(prev => ({ ...prev, category: "", person: "Family", frequency: "", inflation_percent: 0 }));
        }
        setIsDynamic(false);
        setLinkedItemType("");
        setLinkedItemId(null);
        setPercentage("");
      }
    };
    loadSettingsAndItem();
    
    // Listen for category updates
    const handleCategoryUpdate = () => {
      console.log("Categories updated event received in CashFlowFormModal, reloading settings...");
      loadSettingsAndItem();
    };
    window.addEventListener('categoriesUpdated', handleCategoryUpdate);
    
    return () => {
      window.removeEventListener('categoriesUpdated', handleCategoryUpdate);
    };
  }, [itemToEdit, type, isOpen]);

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
          setAssets(assetsRes.data || []); // NEW: Set assets for reinvestment account selection
        } catch (error) {
          console.error("Failed to fetch linked items:", error);
        }
      };
      fetchLinkedItems();
    }
  }, [isOpen]); // Only re-run when modal opens/closes

  const save = async () => {
    if (!newItem.category || !newItem.description) return; // Value can be dynamic or 0

    // Validation for dynamic items (but skip if linked_item_type is "liability" - these are generated expenses)
    if (isDynamic && itemToEdit?.linked_item_type !== "liability") {
      // For income items with asset type, check linkedAssetIds; otherwise check linkedItemId
      const hasValidLink = (type === "income" && linkedItemType === "asset") 
        ? (linkedAssetIds.length > 0)
        : (linkedItemId !== null);
      if (!linkedItemType || !hasValidLink || percentage === "" || isNaN(parseFloat(percentage))) {
        alert("Please select a linked item type, an item (or assets for income), and enter a valid percentage.");
        return;
      }
    } else if (!isDynamic && (newItem.value === "" || isNaN(parseFloat(newItem.value)))) {
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
      value: isDynamic ? 0.0 : (() => { const val = parseFloat(newItem.value) || 0; const isSS = (itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - ")); return isSS ? Math.round(val) : val; })(),
      annual_increase_percent: type === "income" ? parseFloat(newItem.annual_increase_percent || 0) : 0,
      inflation_percent: type === "expense" ? parseFloat(newItem.inflation_percent || defaultInflation) : 0,
      person: newItem.person === "Family" ? null : (newItem.person || null),
      start_date: newItem.start_date || null,
      end_date: newItem.end_date || null,
      taxable: type === "income" ? newItem.taxable : false,
      tax_deductible: type === "expense" ? newItem.tax_deductible : false,
      // Dynamic fields
      linked_item_id: isDynamic ? linkedItemId : null,
      linked_item_type: isDynamic ? linkedItemType : null,
      percentage: isDynamic ? parseFloat(percentage) : null,
      linked_asset_ids: (type === "income" && isDynamic && linkedItemType === "asset" && linkedAssetIds.length > 0) ? linkedAssetIds : null, // NEW: Multi-select asset IDs for income items
      contributes_to_asset_id: type === "expense" ? newItem.contributes_to_asset_id : null, // NEW: Only for expenses
      reinvest_dividends: (type === "income" && (newItem.category?.toLowerCase().includes("dividend") || newItem.description?.toLowerCase().includes("dividend"))) ? reinvestDividends : false, // NEW: Only for dividend income
      reinvestment_account_id: (type === "income" && reinvestDividends) ? reinvestmentAccountId : null, // NEW: Only if reinvesting dividends
      is_qualified_dividend: type === "income" ? isQualifiedDividend : null, // NEW: Whether dividends are qualified (only for income items, defaults to true)
      allow_value_overwrite: allowValueOverwrite, // NEW: Whether system can overwrite yearly_value
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

  // Helper to get asset options for contributes_to_asset_id
  const getAssetOptions = () => {
    return availableLinkedItems.assets.map(asset => ({
      id: asset.id,
      name: asset.name,
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.description}` : `Add New ${type === 'income' ? 'Income' : 'Expense'} Item`}>
      <div className="cashflow-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(8, 1fr)', gap: '10px' }}> {/* First row: Person, Description, Category, Dynamic, Value, Frequency - expanded to 8 columns */} 
            <div className="form-field">
              <label htmlFor="person-select">Person</label>
              <select id="person-select" value={newItem.person || "Family"} onChange={(e) => setNewItem({ ...newItem, person: e.target.value })}> 
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
                  setLinkedAssetIds([]); // NEW: Reset linked asset IDs
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

            <div className="form-field">
              <label htmlFor="value-input">Value</label>
              {((itemToEdit?.description?.startsWith("Social Security - ")) || (newItem.description?.startsWith("Social Security - "))) && (
                <div style={{ marginTop: '5px', marginBottom: '8px', fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label htmlFor="allow-overwrite-checkbox" style={{ cursor: 'pointer', margin: 0 }}>
                    Allow Overwrite
                  </label>
                  <input
                    type="checkbox"
                    id="allow-overwrite-checkbox"
                    checked={allowValueOverwrite}
                    onChange={(e) => setAllowValueOverwrite(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              )}
              {(() => {
                const description = itemToEdit?.description || newItem.description;
                const isFederalTax = description === FEDERAL_TAX_EXPENSE_DESCRIPTION;
                
                if (isFederalTax) {
                  // Calculate current year tax for Federal Income Tax expense item
                  let currentYearTaxValue = null;
                  if (userSettings) {
                    try {
                      const currentYear = new Date().getFullYear();
                      
                      // Sum taxable income
                      const totalTaxableIncome = (incomeItems || []).reduce((sum, item) => {
                        if (item.taxable && item.yearly_value) {
                          return sum + (item.yearly_value || 0);
                        }
                        return sum;
                      }, 0);
                      
                      // Sum tax-deductible expenses (excluding the Federal Income Tax expense item itself)
                      const totalTaxDeductibleExpenses = (expenseItems || []).reduce((sum, item) => {
                        if (item.description !== FEDERAL_TAX_EXPENSE_DESCRIPTION && item.tax_deductible && item.yearly_value) {
                          return sum + (item.yearly_value || 0);
                        }
                        return sum;
                      }, 0);
                      
                      const taxResult = calculateTaxableIncome(
                        totalTaxableIncome,
                        totalTaxDeductibleExpenses,
                        userSettings.tax_filing_status || "Single",
                        userSettings.person1_birthdate,
                        userSettings.person2_birthdate,
                        currentYear
                      );
                      
                      currentYearTaxValue = Math.round(taxResult.taxOwed || 0);
                    } catch (error) {
                      console.error('Error calculating current year tax:', error);
                    }
                  }
                  
                  return (
                    <>
                      <input
                        id="value-input"
                        type="number"
                        step="1"
                        value={currentYearTaxValue !== null ? currentYearTaxValue : (itemToEdit?.yearly_value || 0)}
                        disabled
                        style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                      />
                      <div style={{ marginTop: '6px', fontSize: '0.85em', color: '#666', fontStyle: 'italic', lineHeight: '1.4' }}>
                        This value is calculated automatically during projections based on your taxable income and tax filing status.
                        <br />
                        The value shown is for the current year ({new Date().getFullYear()}).
                      </div>
                    </>
                  );
                }
                return null;
              })() || (
                <input
                  id="value-input"
                  type="number"
                  step="1"
                  placeholder={isDynamic ? "Calculated Dynamically" : "Value"}
                  value={isDynamic ? "" : (() => {
                    const isSS = (itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - "));
                    if (isSS && newItem.value) {
                      const numVal = parseFloat(newItem.value);
                      return isNaN(numVal) ? newItem.value : Math.round(numVal).toString();
                    }
                    return newItem.value;
                  })()}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    const isSS = (itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - "));
                    setNewItem({ ...newItem, value: isSS && val ? Math.round(parseFloat(val) || 0).toString() : val });
                  }}
                  disabled={isDynamic || ((itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - ")) && !allowValueOverwrite)}
                />
              )}
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
          <div className="form-row" style={{ gridTemplateColumns: type === "expense" ? 'repeat(6, 1fr)' : 'repeat(7, 1fr)', gap: '10px' }}>

            {isDynamic && (
              <> 
                <div className="form-field">
                  <label htmlFor="linked-item-type-select">Linked Item Type</label>
                  <select
                    id="linked-item-type-select"
                    value={linkedItemType}
                    onChange={(e) => { setLinkedItemType(e.target.value); setLinkedItemId(null); /* Reset linked item on type change */ }}
                    disabled={itemToEdit?.linked_item_type === "liability"} // Disable for generated expenses
                  >
                    <option value="">Select Type</option>
                    <option value="asset">Asset</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div className="form-field" style={type === "income" && linkedItemType === "asset" ? { gridColumn: "span 2", minWidth: "300px" } : {}}>
                  <label htmlFor="linked-item-select">
                    {type === "income" && linkedItemType === "asset" ? "Linked Assets (Multi-select)" : "Linked Item"}
                  </label>
                  {type === "income" && linkedItemType === "asset" ? (
                    <MultiSelectCheckbox
                      options={getLinkedItemOptions()}
                      selectedValues={linkedAssetIds}
                      onChange={(selectedIds) => {
                        setLinkedAssetIds(selectedIds);
                        // Also set linkedItemId to first selected for backward compatibility
                        setLinkedItemId(selectedIds.length > 0 ? selectedIds[0] : null);
                      }}
                      placeholder="Select assets..."
                      disabled={!linkedItemType}
                      maxHeight={200}
                      showCategory={true}
                    />
                  ) : (
                    <select
                      id="linked-item-select"
                      value={linkedItemId || ""}
                      onChange={(e) => {
                        setLinkedItemId(e.target.value ? parseInt(e.target.value) : null);
                        // Clear linkedAssetIds when using single select
                        setLinkedAssetIds([]);
                      }}
                      disabled={!linkedItemType}
                    >
                      <option value="">Select Item</option>
                      {getLinkedItemOptions().map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.category})
                        </option>
                      ))}
                    </select>
                  )}
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

            {/* NEW: Contributes to Asset field, only for expenses */}
            {type === "expense" && (
              <div className="form-field">
                <label htmlFor="contributes-to-asset-select">Contributes to Asset</label>
                <select
                  id="contributes-to-asset-select"
                  value={newItem.contributes_to_asset_id || ""}
                  onChange={(e) => setNewItem({ ...newItem, contributes_to_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">None</option>
                  {getAssetOptions().map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </div>
            )}


          </div>

          {/* NEW: Dividend Reinvestment fields - only shown for income items with "Dividends" category or description */}
          {type === "income" && (newItem.category?.toLowerCase().includes("dividend") || newItem.description?.toLowerCase().includes("dividend")) && (
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div className="form-field">
                <label htmlFor="reinvest-dividends-checkbox">Reinvest Dividends</label>
                <input
                  id="reinvest-dividends-checkbox"
                  type="checkbox"
                  checked={reinvestDividends}
                  onChange={(e) => {
                    setReinvestDividends(e.target.checked);
                    if (!e.target.checked) {
                      setReinvestmentAccountId(null); // Clear account selection if unchecked
                    }
                  }}
                />
              </div>
              {reinvestDividends && (
                <div className="form-field">
                  <label htmlFor="reinvestment-account-select">Reinvestment Account</label>
                  <select
                    id="reinvestment-account-select"
                    value={reinvestmentAccountId || ""}
                    onChange={(e) => setReinvestmentAccountId(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Use Source Asset (if linked) or Default</option>
                    {getAssetOptions().map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="form-row" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}> {/* Second row (original): Annual Increase %, Start Date, End Date, Taxable/Deductible - expanded to 6 columns */} 
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
            {type === "income" && (
              <div className="form-field"> {/* Qualified Dividend - only for income items */} 
                <label htmlFor="qualified-dividend-select">
                  Qualified Dividend
                </label>
                <select
                  id="qualified-dividend-select"
                  value={isQualifiedDividend ? "Yes" : "No"}
                  onChange={(e) => setIsQualifiedDividend(e.target.value === "Yes")}
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
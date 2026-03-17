import React, { useState, useEffect, useMemo } from "react";
import { FormControlLabel, Switch } from "@mui/material";
import CashFlowService from "../services/cashflow.service";
import SettingsService from "../services/settings.service";
import AssetService from "../services/asset.service"; // New import
import LiabilityService from "../services/liability.service"; // New import
import { projectionSwitchSx } from "../utils/projectionUiStyles";
import Modal from "./Modal"; // Import the generic Modal component
import MultiSelectCheckbox from "./MultiSelectCheckbox"; // Import the multi-select checkbox component
import { useAuth } from '../context/AuthContext';
import { calculateTaxableIncome } from '../utils/taxCalculator';
import "./CashFlowFormModal.css"; // Specific styling for this form

const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";
type CashFlowType = 'income' | 'expense';
type CashFlowItem = Record<string, any>;
type LinkedItemsState = {
  assets: Record<string, any>[];
  liabilities: Record<string, any>[];
  income: Record<string, any>[];
  expenses: Record<string, any>[];
};

interface CashFlowFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: CashFlowItem | null;
  type: CashFlowType;
  onSaveSuccess: () => void;
  incomeItems?: CashFlowItem[];
  expenseItems?: CashFlowItem[];
}

// Utility functions for number formatting with thousand separators
const formatNumber = (value: string | number | null | undefined): string => {
  if (value === "" || value === null || value === undefined) return "";
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(numValue)) return "";
  return numValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const parseNumber = (value: string | number | null | undefined): string => {
  if (value === "" || value === null || value === undefined) return "";
  const cleaned = value.toString().replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? "" : parsed.toString();
};

export default function CashFlowFormModal({
  isOpen, // From Modal component
  onClose, // From Modal component
  item: itemToEdit, // The item data if we're editing
  type, // 'income' or 'expense'
  onSaveSuccess, // Callback after successful save
  incomeItems = [], // Income items for tax calculation
  expenseItems = [], // Expense items for tax calculation
}: CashFlowFormModalProps) {
  const { userSettings } = useAuth();
  const typedUserSettings: any = userSettings;
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [personOptions, setPersonOptions] = useState<string[]>([]);
  const [defaultInflation, setDefaultInflation] = useState(2.0);
  const [isDynamic, setIsDynamic] = useState(false); // New state for dynamic item
  const [linkedItemType, setLinkedItemType] = useState(""); // New state for linked item type
  const [linkedItemId, setLinkedItemId] = useState<number | null>(null); // New state for linked item ID
  const [linkedAssetIds, setLinkedAssetIds] = useState<number[]>([]); // NEW: Array of selected asset IDs for multi-select
  const [percentage, setPercentage] = useState(""); // New state for percentage
  const [reinvestDividends, setReinvestDividends] = useState(false); // NEW: Whether to reinvest dividends
  const [reinvestmentAccountId, setReinvestmentAccountId] = useState<number | null>(null); // NEW: Account ID for reinvestment
  const [isQualifiedDividend, setIsQualifiedDividend] = useState(false); // NEW: Whether dividends are qualified (defaults to false)
  const [allowValueOverwrite, setAllowValueOverwrite] = useState(false); // NEW: Whether user can overwrite the generated value (defaults to False - system controls)
  const [availableLinkedItems, setAvailableLinkedItems] = useState<LinkedItemsState>({
    assets: [],
    liabilities: [],
    income: [],
    expenses: [],
  }); // New state for fetching available linked items
  const [assets, setAssets] = useState<Record<string, any>[]>([]); // NEW: Available assets for reinvestment account selection

  const [newItem, setNewItem] = useState<any>({
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
          
          // For one-time items, ensure start_date and end_date are the same
          const isOneTime = itemToEdit.frequency === 'one-time';
          let startDate = itemToEdit.start_date || "";
          let endDate = itemToEdit.end_date || "";
          if (isOneTime) {
            // Use start_date if available, otherwise end_date, otherwise empty
            const oneTimeDate = startDate || endDate || "";
            startDate = oneTimeDate;
            endDate = oneTimeDate;
          }

          setNewItem((prev: any) => ({
            ...prev,
            ...itemToEdit,
            value: displayValue, // This will be ignored if isDynamic is true
            person: mappedPerson, // Map null to "Family"
            annual_increase_percent: itemToEdit.annual_increase_percent ?? 0,
            inflation_percent: itemToEdit.inflation_percent ?? inflation,
            taxable: itemToEdit.taxable ?? false,
            tax_deductible: itemToEdit.tax_deductible ?? false,
            start_date: startDate,
            end_date: endDate,
            contributes_to_asset_id: itemToEdit.contributes_to_asset_id || null, // NEW
          }));
          // Initialize dynamic fields if present in itemToEdit
          setIsDynamic(!!(itemToEdit.linked_item_id || (itemToEdit.linked_asset_ids && itemToEdit.linked_asset_ids.length > 0))); // Set to true if linked_item_id or linked_asset_ids exists
          setLinkedItemType(itemToEdit.linked_item_type || "");
          setLinkedItemId(itemToEdit.linked_item_id || null);
          // NEW: Initialize linked asset IDs - if item has linked_item_id for an asset but no linked_asset_ids, 
          // populate linked_asset_ids with the single linked_item_id for backward compatibility
          if (itemToEdit.linked_asset_ids && itemToEdit.linked_asset_ids.length > 0) {
            // Item already has linked_asset_ids (multi-select)
            setLinkedAssetIds(itemToEdit.linked_asset_ids);
          } else if (itemToEdit.linked_item_id && itemToEdit.linked_item_type === "asset") {
            // Item has old linked_item_id (single-select) - convert to multi-select array
            setLinkedAssetIds([itemToEdit.linked_item_id]);
          } else {
            // No linked assets
            setLinkedAssetIds([]);
          }
          setPercentage(itemToEdit.percentage !== null ? itemToEdit.percentage.toString() : "");
          setReinvestDividends(itemToEdit.reinvest_dividends || false); // NEW: Initialize dividend reinvestment
          setReinvestmentAccountId(itemToEdit.reinvestment_account_id || null); // NEW: Initialize reinvestment account
          setIsQualifiedDividend(itemToEdit.is_qualified_dividend !== undefined ? itemToEdit.is_qualified_dividend : false); // NEW: Initialize qualified dividend (default to false)
          // For Social Security items, always default to false (system controls) regardless of database value
          const isSocialSecurity = itemToEdit.description?.startsWith("Social Security - ");
          setAllowValueOverwrite(isSocialSecurity ? false : (itemToEdit.allow_value_overwrite !== undefined ? itemToEdit.allow_value_overwrite : false)); // NEW: Initialize allow value overwrite (default to false - system controls by default)

        } else {
          // Ensure empty defaults for new item
          setNewItem((prev: any) => ({
            ...prev,
            category: "",
            description: "",
            value: "",
            frequency: "",
            annual_increase_percent: 0,
            inflation_percent: inflation, // Default to fetched inflation for new expenses
            person: "Family",
            start_date: `${new Date().getFullYear()}-01-01`, // Pre-populate with Jan 1 of current year
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
          setIsQualifiedDividend(false); // NEW: Reset qualified dividend (default to false)
          setAllowValueOverwrite(false); // NEW: Reset allow value overwrite (default to false - system controls)
        }
      } catch (e: any) {
        const defaultCategories = type === "income"
          ? ["Salary", "Bonus", "Investment Income", "Other"]
          : ["Housing", "Transportation", "Food", "Healthcare", "Entertainment", "Other"];
        setTypeOptions(defaultCategories);
        setPersonOptions(["Family", "Person 1", "Person 2"]);
        if (!itemToEdit) {
          setNewItem((prev: any) => ({ ...prev, category: "", person: "Family", frequency: "", inflation_percent: 0 }));
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
        } catch (error: any) {
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
      annual_increase_percent: type === "income" ? Number(newItem.annual_increase_percent || 0) : 0,
      inflation_percent: type === "expense" ? Number(newItem.inflation_percent || defaultInflation) : 0,
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
      is_qualified_dividend: type === "income" ? isQualifiedDividend : null, // NEW: Whether dividends are qualified (only for income items, defaults to false)
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
    } catch (error: any) {
      
      // Extract helpful error message from response
      let errorMessage = "Failed to save item. Please try again.";
      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.detail) {
          // Handle different detail formats
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            // Validation errors - format nicely
            const validationErrors = errorData.detail.map((err: any) => {
              if (typeof err === 'object' && err.loc && err.msg) {
                const field = err.loc[err.loc.length - 1];
                return `${field}: ${err.msg}`;
              }
              return String(err);
            }).join(', ');
            errorMessage = `Validation error: ${validationErrors}`;
          } else if (typeof errorData.detail === 'object') {
            errorMessage = JSON.stringify(errorData.detail);
          }
        } else {
          errorMessage = `Error: ${JSON.stringify(errorData)}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  const cancelEdit = () => {
    onClose(); // Just close the modal on cancel
  };

  // Helper to get linked item options based on selected type
    const getLinkedItemOptions = () => {
    const lowerCaseType = linkedItemType.toLowerCase();
    const typeToKeyMap: Record<string, keyof LinkedItemsState> = {
      "asset": "assets",
      "liability": "liabilities",
      "income": "income",
      "expense": "expenses"
    };
    const key = typeToKeyMap[lowerCaseType as keyof typeof typeToKeyMap];
    const items = availableLinkedItems[key];
    if (!items) return [];
    // For cash flow items, filter out the item being edited to prevent self-linking
    return items.filter((item: any) => !(itemToEdit && item.id === itemToEdit.id)).map((item: any) => ({
      id: item.id,
      name: item.name || item.description, // Assets/Liabilities have name, CashFlowItems have description
      category: item.category,
    }));
  };

  // Helper to get asset options for contributes_to_asset_id
  const getAssetOptions = () => {
    return availableLinkedItems.assets.map((asset: any) => ({
      id: asset.id,
      name: asset.name,
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.description}` : `Add New ${type === 'income' ? 'Income' : 'Expense'} Item`}>
      <div className="cashflow-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}> {/* First row: Person, Description, Category, Dynamic, Value, Frequency */} 
            <div className="form-field">
              <label htmlFor="person-select">Person</label>
              <select id="person-select" value={newItem.person || "Family"} onChange={(e: any) => setNewItem({ ...newItem, person: e.target.value })}> 
                {personOptions.map((opt: any) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="description-input">Description (Name) *</label>
              <input
                id="description-input"
                autoComplete="off"
                type="text"
                placeholder="Description (Name)"
                value={newItem.description}
                onChange={(e: any) => setNewItem({ ...newItem, description: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="category-select">Category *</label>
              <select id="category-select" value={newItem.category} onChange={(e: any) => setNewItem({ ...newItem, category: e.target.value })}> 
                <option value="">Select Category</option>
                {[...typeOptions].sort().map((opt: any) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="is-dynamic-select">Dynamic (Ex: Pct to IRA)</label>
              <select
                id="is-dynamic-select"
                autoComplete="off"
                value={isDynamic ? "Yes" : "No"}
                onChange={(e: any) => {
                  const newIsDynamic = e.target.value === "Yes";
                  setIsDynamic(newIsDynamic);
                  // Reset linked item fields when toggling dynamic status
                  setLinkedItemType("");
                  setLinkedItemId(null);
                  setLinkedAssetIds([]); // NEW: Reset linked asset IDs
                  setPercentage("");
                  // If switching from dynamic to non-dynamic, re-enable value/frequency
                  if (!newIsDynamic && !itemToEdit) {
                    setNewItem((prev: any) => ({...prev, value: "", frequency: ""}));
                  }
                }}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="value-input">Value{!isDynamic ? ' *' : ''}</label>
              {((itemToEdit?.description?.startsWith("Social Security - ")) || (newItem.description?.startsWith("Social Security - "))) && (
                <FormControlLabel
                  control={
                    <Switch
                      sx={projectionSwitchSx}
                      id="allow-overwrite-checkbox"
                      checked={allowValueOverwrite}
                      onChange={(e: any) => setAllowValueOverwrite(e.target.checked)}
                    />
                  }
                  label="Allow Overwrite"
                  sx={{ mt: 0.25, mb: 1, fontSize: '0.9em' }}
                />
              )}
              {(() => {
                const description = itemToEdit?.description || newItem.description;
                const isFederalTax = description === FEDERAL_TAX_EXPENSE_DESCRIPTION;
                
                if (isFederalTax) {
                  // Calculate current year tax for Federal Income Tax expense item
                  let currentYearTaxValue = null;
                  if (typedUserSettings) {
                    try {
                      const currentYear = new Date().getFullYear();
                      
                      // Sum taxable income
                      const totalTaxableIncome = (incomeItems || []).reduce((sum: any, item: any) => {
                        if (item.taxable && item.yearly_value) {
                          return sum + (item.yearly_value || 0);
                        }
                        return sum;
                      }, 0);
                      
                      // Sum tax-deductible expenses (excluding the Federal Income Tax expense item itself)
                      const totalTaxDeductibleExpenses = (expenseItems || []).reduce((sum: any, item: any) => {
                        if (item.description !== FEDERAL_TAX_EXPENSE_DESCRIPTION && item.tax_deductible && item.yearly_value) {
                          return sum + (item.yearly_value || 0);
                        }
                        return sum;
                      }, 0);
                      
                      const taxResult = calculateTaxableIncome(
                        totalTaxableIncome,
                        totalTaxDeductibleExpenses,
                        typedUserSettings.tax_filing_status || "Single",
                        typedUserSettings.person1_birthdate,
                        typedUserSettings.person2_birthdate,
                        currentYear
                      );
                      
                      currentYearTaxValue = Math.round(taxResult.taxOwed || 0);
                    } catch (error: any) {
                    }
                  }
                  
                  return (
                    <input
                      id="value-input"
                      autoComplete="off"
                      type="number"
                      step="1"
                      value={currentYearTaxValue !== null ? currentYearTaxValue : (itemToEdit?.yearly_value || 0)}
                      disabled
                      style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                  );
                }
                return null;
              })() || (
                <input
                  id="value-input"
                  autoComplete="off"
                  type="text"
                  placeholder={isDynamic ? "Calculated Dynamically" : "Value"}
                  value={isDynamic ? "" : (() => {
                    if (!newItem.value) return "";
                    const isSS = (itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - "));
                    const numericValue = parseNumber(newItem.value);
                    if (isSS && numericValue) {
                      return formatNumber(Math.round(parseFloat(numericValue) || 0));
                    }
                    return formatNumber(numericValue);
                  })()}
                  onFocus={(e: any) => {
                    e.target.select();
                    // Remove commas when focused for easier editing
                    const numericValue = parseNumber(e.target.value);
                    const isSS = (itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - "));
                    const processedValue = isSS && numericValue ? Math.round(parseFloat(numericValue) || 0).toString() : numericValue;
                    setNewItem({ ...newItem, value: processedValue });
                    e.target.value = processedValue;
                  }}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    const numericValue = parseNumber(val);
                    const isSS = (itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - "));
                    const processedValue = isSS && numericValue ? Math.round(parseFloat(numericValue) || 0).toString() : numericValue;
                    setNewItem({ ...newItem, value: processedValue });
                  }}
                  onBlur={(e: any) => {
                    // Format with commas when user leaves the field
                    const numericValue = parseNumber(e.target.value);
                    const isSS = (itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - "));
                    const processedValue = isSS && numericValue ? Math.round(parseFloat(numericValue) || 0).toString() : numericValue;
                    setNewItem({ ...newItem, value: processedValue });
                    e.target.value = processedValue ? formatNumber(processedValue) : "";
                  }}
                  disabled={isDynamic || ((itemToEdit?.description?.startsWith("Social Security - ") || newItem.description?.startsWith("Social Security - ")) && !allowValueOverwrite)}
                />
              )}
            </div>

            <div className="form-field">
              <label htmlFor="frequency-select">Frequency</label>
              <select id="frequency-select" value={newItem.frequency} onChange={(e: any) => setNewItem({ ...newItem, frequency: e.target.value })} disabled={isDynamic}> 
                <option value="">Select Frequency</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="one-time">One-time</option>
              </select>
            </div>
            {newItem.frequency === "one-time" && (
              <div className="form-field">
                <label htmlFor="one-time-date">Date *</label>
                <input
                  id="one-time-date"
                  name="one-time-date"
                  autoComplete="off"
                  type="date"
                  value={newItem.start_date || ""}
                  onChange={(e: any) => setNewItem({ ...newItem, start_date: e.target.value, end_date: e.target.value })}
                  required
                />
              </div>
            )}
          </div>
          {/* Separate row for Federal Income Tax value note */}
          {(() => {
            const description = itemToEdit?.description || newItem.description;
            const isFederalTax = description === FEDERAL_TAX_EXPENSE_DESCRIPTION;
            if (isFederalTax) {
              return (
                <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: '10px' }}>
                  <div style={{ fontSize: '0.85em', color: '#666', fontStyle: 'italic', lineHeight: '1.4', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                    This value is calculated automatically during projections based on your taxable income and tax filing status.
                    <br />
                    The value shown is for the current year ({new Date().getFullYear()}).
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* New row for dynamic item configuration */}
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>

            {isDynamic && (
              <> 
                <div className="form-field">
                  <label htmlFor="linked-item-type-select">Linked Item Type *</label>
                  <select
                    id="linked-item-type-select"
                    value={linkedItemType}
                    onChange={(e: any) => { setLinkedItemType(e.target.value); setLinkedItemId(null); /* Reset linked item on type change */ }}
                    disabled={itemToEdit?.linked_item_type === "liability"} // Disable for generated expenses
                  >
                    <option value="">Select Type</option>
                    <option value="asset">Asset</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div className="form-field" style={type === "income" && linkedItemType === "asset" ? { gridColumn: "span 2", minWidth: "300px" } : {}}>
                  <label htmlFor="linked-item-select">
                    {type === "income" && linkedItemType === "asset" ? "Linked Assets (Multi-select) *" : "Linked Item *"}
                  </label>
                  {type === "income" && linkedItemType === "asset" ? (
                    <MultiSelectCheckbox
                      options={getLinkedItemOptions()}
                      selectedValues={linkedAssetIds}
                      onChange={(selectedIds: number[]) => {
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
                      onChange={(e: any) => {
                        setLinkedItemId(e.target.value ? parseInt(e.target.value) : null);
                        // Clear linkedAssetIds when using single select
                        setLinkedAssetIds([]);
                      }}
                      disabled={!linkedItemType}
                    >
                      <option value="">Select Item</option>
                      {getLinkedItemOptions().map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.category})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="percentage-input">Percentage (%) *</label>
                  <input
                    id="percentage-input"
                    name="percentage-input"
                    autoComplete="off"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Percentage"
                    value={percentage}
                    onChange={(e: any) => setPercentage(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* NEW: Contributes to Asset field, only for expenses */}
            {type === "expense" && (
              <div className="form-field">
                <label htmlFor="contributes-to-asset-select">Contributes to Asset (Ex: $100 to HSA) </label>
                <select
                  id="contributes-to-asset-select"
                  name="contributes-to-asset-select"
                  autoComplete="off"
                  value={newItem.contributes_to_asset_id || ""}
                  onChange={(e: any) => setNewItem({ ...newItem, contributes_to_asset_id: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">None</option>
                  {getAssetOptions().map((asset: any) => (
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
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <div className="form-field">
                <FormControlLabel
                  control={
                    <Switch
                      sx={projectionSwitchSx}
                      id="reinvest-dividends-checkbox"
                      checked={reinvestDividends}
                      onChange={(e: any) => {
                        setReinvestDividends(e.target.checked);
                        if (!e.target.checked) {
                          setReinvestmentAccountId(null); // Clear account selection if unchecked
                        }
                      }}
                    />
                  }
                  label="Reinvest Dividends"
                  sx={{ m: 0 }}
                />
              </div>
              {reinvestDividends && (
                <div className="form-field">
                  <label htmlFor="reinvestment-account-select">Reinvestment Account</label>
                  <select
                    id="reinvestment-account-select"
                    value={reinvestmentAccountId || ""}
                    onChange={(e: any) => setReinvestmentAccountId(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Use Source Asset (if linked) or Default</option>
                    {getAssetOptions().map((asset: any) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}> {/* Second row: Annual Increase %, Start Date, End Date, Taxable/Deductible */} 
            {type === "income" && (
              <div className="form-field">
                <label htmlFor="annual-increase">Annual Increase %</label>
                <input
                  id="annual-increase"
                  name="annual-increase"
                  autoComplete="off"
                  type="number"
                  step="0.1"
                  placeholder="Annual Increase %"
                  value={newItem.annual_increase_percent}
                  onFocus={(e: any) => e.target.select()}
                  onChange={(e: any) => setNewItem({ ...newItem, annual_increase_percent: Number(e.target.value) })}
                  disabled={isDynamic} // Disable if dynamic
                />
              </div>
            )}

            {type === "expense" && (
              <div className="form-field">
                <label htmlFor="inflation-percent">Inflation %</label>
                <input
                  id="inflation-percent"
                  name="inflation-percent"
                  autoComplete="off"
                  type="number"
                  step="0.1"
                  placeholder="Inflation %"
                  value={newItem.inflation_percent}
                  onFocus={(e: any) => e.target.select()}
                  onChange={(e: any) => setNewItem({ ...newItem, inflation_percent: Number(e.target.value) })}
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="start-date-input">Start Date</label>
              <input
                id="start-date-input"
                name="start-date-input"
                autoComplete="off"
                type="date"
                placeholder="Start Date"
                value={newItem.start_date}
                onChange={(e: any) => setNewItem({ ...newItem, start_date: e.target.value })}
                disabled={isDynamic || newItem.frequency === "one-time"} // Disable if dynamic or one-time
              />
            </div>

            <div className="form-field"> 
              <label htmlFor="end-date-input">End Date</label>
              <input
                id="end-date-input"
                name="end-date-input"
                autoComplete="off"
                type="date"
                placeholder="End Date"
                value={newItem.end_date || ""}
                onChange={(e: any) => setNewItem({ ...newItem, end_date: e.target.value })}
                disabled={isDynamic || newItem.frequency === "one-time"} // Disable if dynamic or one-time
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
                  onChange={(e: any) =>
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
              <div className="form-field"> {/* Qualified Dividends / Capital Gains - only for income items */} 
                <label htmlFor="qualified-dividend-select">
                  Qualified Dividends / Capital Gains
                </label>
                <select
                  id="qualified-dividend-select"
                  value={isQualifiedDividend ? "Yes" : "No"}
                  onChange={(e: any) => setIsQualifiedDividend(e.target.value === "Yes")}
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
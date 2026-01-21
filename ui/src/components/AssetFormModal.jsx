import React, { useState, useEffect } from "react";
import AssetService from "../services/asset.service";
import SettingsService from "../services/settings.service";
import AccountService from "../services/account.service";
import CashFlowService from "../services/cashflow.service";
import Modal from "./Modal"; // Import the generic Modal component
import "./AssetFormModal.css"; // Specific styling for this form

// Utility functions for number formatting with thousand separators
const formatNumber = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(numValue)) return "";
  return numValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const cleaned = value.toString().replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? "" : parsed.toString();
};

export default function AssetFormModal({
  isOpen,
  onClose,
  item: itemToEdit,
  onSaveSuccess,
}) {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);
  const [trackInterestAsIncome, setTrackInterestAsIncome] = useState(false);
  const [interestRate, setInterestRate] = useState(""); // Separate interest rate field
  const [trackDividendsAsIncome, setTrackDividendsAsIncome] = useState(false);
  const [dividendRate, setDividendRate] = useState(""); // Separate dividend rate field
  const [retirementInterestRate, setRetirementInterestRate] = useState(""); // Interest rate for retirement accounts (reinvested, not taxable)
  const [retirementDividendRate, setRetirementDividendRate] = useState(""); // Dividend rate for retirement accounts (reinvested, not taxable)
  const [existingLinkedInterestId, setExistingLinkedInterestId] = useState(null);
  const [existingLinkedDividendId, setExistingLinkedDividendId] = useState(null);
  const [warningMessage, setWarningMessage] = useState("");
  
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    value: "",
    annual_increase_percent: 0,
    annual_change_type: "increase", // Default to increase for assets
    account_id: null,
    start_date: "",
    end_date: "",
  });
  
  // Check if the selected account is a retirement account (use useMemo to avoid initialization issues)
  const selectedAccount = React.useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    const accountId = itemToEdit?.account_id || newItem.account_id;
    return accounts.find(acc => acc.id === accountId);
  }, [accounts, itemToEdit?.account_id, newItem.account_id]);
  
  const isRetirementAccount = selectedAccount?.is_retirement || false;

  useEffect(() => {
    if (!isOpen) return; // Only load when modal is open
    
    const loadSettings = async () => {
      try {
        const [settingsRes, accountsRes, incomeRes] = await Promise.all([
          SettingsService.getSettings(),
          AccountService.getAllAccounts().catch(() => []), // Don't fail if accounts endpoint doesn't exist yet
          CashFlowService.list(true).catch(() => ({ data: [] })) // Load income items to check for existing links
        ]);
        const cats = settingsRes.data.asset_categories || [];
        setCategories(cats);
        setAccounts(accountsRes || []);
        setIncomeItems(incomeRes.data || []);

        if (itemToEdit) {
          setNewItem(prev => ({
            ...prev,
            ...itemToEdit,
            value: itemToEdit.value?.toString() || '',
            annual_increase_percent: itemToEdit.annual_increase_percent ?? 0,
            annual_change_type: itemToEdit.annual_change_type || "increase",
            account_id: itemToEdit.account_id || null,
            start_date: itemToEdit.start_date || '',
            end_date: itemToEdit.end_date || '',
          }));
          
          // Load retirement interest and dividend rates if they exist
          // If they exist, we need to adjust annual_increase_percent to show only the internal rate
          // (since annual_increase_percent currently contains the total for backward compatibility)
          const hasRetirementRates = (itemToEdit.retirement_interest_rate !== null && itemToEdit.retirement_interest_rate !== undefined) ||
                                     (itemToEdit.retirement_dividend_rate !== null && itemToEdit.retirement_dividend_rate !== undefined);
          
          if (hasRetirementRates && isRetirementAccount) {
            // Extract the internal growth rate by subtracting the retirement rates from the total
            const retirementInterest = itemToEdit.retirement_interest_rate || 0;
            const retirementDividend = itemToEdit.retirement_dividend_rate || 0;
            const totalRate = itemToEdit.annual_increase_percent || 0;
            const internalRate = totalRate - retirementInterest - retirementDividend;
            
            // Update newItem to show only the internal rate
            setNewItem(prev => ({
              ...prev,
              annual_increase_percent: Math.max(0, internalRate) // Ensure non-negative
            }));
            
            setRetirementInterestRate(retirementInterest > 0 ? retirementInterest.toString() : "");
            setRetirementDividendRate(retirementDividend > 0 ? retirementDividend.toString() : "");
          } else {
            // No retirement rates stored - this might be old data or non-retirement account
            setRetirementInterestRate("");
            setRetirementDividendRate("");
          }

          // Check for existing income items linked to this asset
          const linkedIncomeItems = incomeRes.data?.filter(item => 
            item.linked_item_type === "asset" && 
            (item.linked_item_id === itemToEdit.id || 
             (item.linked_asset_ids && item.linked_asset_ids.includes(itemToEdit.id)))
          ) || [];
          
          // Check for interest income (category or description contains "interest")
          const linkedInterest = linkedIncomeItems.find(item => 
            item.category?.toLowerCase().includes('interest') || 
            item.description?.toLowerCase().includes('interest')
          );
          
          // Check for dividend income (category or description contains "dividend")
          const linkedDividend = linkedIncomeItems.find(item => 
            item.category?.toLowerCase().includes('dividend') || 
            item.description?.toLowerCase().includes('dividend')
          );
          
          if (linkedInterest) {
            setTrackInterestAsIncome(true);
            setExistingLinkedInterestId(linkedInterest.id);
            setInterestRate(linkedInterest.percentage?.toString() || "");
          } else {
            setTrackInterestAsIncome(false);
            setExistingLinkedInterestId(null);
            setInterestRate("");
          }
          
          if (linkedDividend) {
            setTrackDividendsAsIncome(true);
            setExistingLinkedDividendId(linkedDividend.id);
            setDividendRate(linkedDividend.percentage?.toString() || "");
          } else {
            setTrackDividendsAsIncome(false);
            setExistingLinkedDividendId(null);
            setDividendRate("");
          }
          setWarningMessage(""); // No warnings needed - they're separate
        } else {
          // Prepopulate start_date with Jan 1 of current year when adding new asset
          const currentYear = new Date().getFullYear();
          const defaultStartDate = `${currentYear}-01-01`;
          
          setNewItem(prev => ({
            ...prev,
            name: "",
            category: "",
            value: "",
            annual_increase_percent: 0,
            annual_change_type: "increase",
            account_id: null,
            start_date: defaultStartDate,
            end_date: "",
          }));
          setTrackInterestAsIncome(false);
          setExistingLinkedInterestId(null);
          setInterestRate("");
          setTrackDividendsAsIncome(false);
          setExistingLinkedDividendId(null);
          setDividendRate("");
        }
      } catch (e) {
        console.error("Failed to load settings", e);
        setCategories([]);
        setAccounts([]);
        setIncomeItems([]);
        if (!itemToEdit) {
          setNewItem(prev => ({ ...prev, category: "", annual_change_type: "increase", account_id: null }));
        }
      }
    };
    loadSettings();
  }, [itemToEdit, isOpen]); // Reload categories when modal opens

  // Reset fields when switching between retirement and non-retirement accounts
  useEffect(() => {
    // Only reset if account_id actually changed (not on initial load)
    if (newItem.account_id !== null || itemToEdit?.account_id) {
      if (isRetirementAccount) {
        // Switching to retirement: clear taxable income tracking
        setTrackInterestAsIncome(false);
        setInterestRate("");
        setTrackDividendsAsIncome(false);
        setDividendRate("");
      } else {
        // Switching to non-retirement: clear retirement rates
        setRetirementInterestRate("");
        setRetirementDividendRate("");
      }
    }
  }, [newItem.account_id, isRetirementAccount]);

  const save = async () => {
    if (!newItem.name || !newItem.category || !newItem.value || !newItem.annual_change_type) return;
    
    // Validate interest rate if checkbox is checked
    if (trackInterestAsIncome && (!interestRate || isNaN(parseFloat(interestRate)) || parseFloat(interestRate) <= 0)) {
      alert("Please enter a valid interest rate when 'Track Interest as Taxable Income' is enabled.");
      return;
    }
    
    // Validate dividend rate if checkbox is checked
    if (trackDividendsAsIncome && (!dividendRate || isNaN(parseFloat(dividendRate)) || parseFloat(dividendRate) <= 0)) {
      alert("Please enter a valid dividend rate when 'Track Dividends as Taxable Income' is enabled.");
      return;
    }

    // For retirement accounts, store interest and dividend rates separately
    // Calculate total growth rate for use in calculations (Internal + Interest + Dividend)
    let totalGrowthRate = parseFloat(newItem.annual_increase_percent || 0);
    // Parse retirement rates, handling empty strings and whitespace
    const retirementInterestStr = (retirementInterestRate || "").trim();
    const retirementDividendStr = (retirementDividendRate || "").trim();
    const retirementInterest = isRetirementAccount ? (retirementInterestStr !== "" ? parseFloat(retirementInterestStr) : 0) : 0;
    const retirementDividend = isRetirementAccount ? (retirementDividendStr !== "" ? parseFloat(retirementDividendStr) : 0) : 0;
    
    if (isRetirementAccount) {
      totalGrowthRate = totalGrowthRate + retirementInterest + retirementDividend;
    }

    const assetPayload = {
      name: newItem.name,
      category: newItem.category,
      value: parseFloat(newItem.value),
      annual_increase_percent: totalGrowthRate, // Total growth rate (Internal + Interest + Dividend for retirement accounts)
      annual_change_type: newItem.annual_change_type,
      account_id: newItem.account_id || null,
      // Save retirement rates if they are valid numbers (including 0.04, etc.)
      // Only save if the string is not empty and the parsed value is not NaN
      retirement_interest_rate: isRetirementAccount ? (retirementInterestStr !== "" && !isNaN(retirementInterest) ? retirementInterest : null) : null,
      retirement_dividend_rate: isRetirementAccount ? (retirementDividendStr !== "" && !isNaN(retirementDividend) ? retirementDividend : null) : null,
      start_date: newItem.start_date || null,
      end_date: newItem.end_date || null,
    };

    try {
      let savedAsset;
      let assetId;
      if (itemToEdit) {
        savedAsset = await AssetService.update(itemToEdit.id, assetPayload);
        assetId = itemToEdit.id;
      } else {
        savedAsset = await AssetService.create(assetPayload);
        // Axios response structure: response.data contains the actual response body
        assetId = savedAsset.data?.id;
        if (!assetId) {
          console.error("Failed to get asset ID from response:", savedAsset);
          alert("Failed to create asset. Please try again.");
          return;
        }
      }

      console.log("Asset saved with ID:", assetId);
      console.log("Track Interest:", trackInterestAsIncome, "Rate:", interestRate);
      console.log("Track Dividends:", trackDividendsAsIncome, "Rate:", dividendRate);

      // Only create income items for non-retirement accounts
      // For retirement accounts, interest/dividends are already included in the asset's growth rate
      if (!isRetirementAccount) {
        // Handle interest tracking income item (separate from asset growth)
        const interestPercent = trackInterestAsIncome ? parseFloat(interestRate || 0) : null;

        if (trackInterestAsIncome && interestPercent > 0 && assetId) {
        // Create or update linked income item
        const incomeItemName = `${newItem.name} Interest`;
        // Try to preserve existing category if updating, otherwise use "Interest"
        const existingIncome = incomeItems.find(item => item.id === existingLinkedInterestId);
        const incomeCategory = existingIncome?.category || "Interest";
        
        const incomePayload = {
          is_income: true,
          category: incomeCategory,
          description: incomeItemName,
          frequency: "yearly",
          value: 0, // Will be calculated dynamically
          annual_increase_percent: 0,
          inflation_percent: 0,
          person: existingIncome?.person || "Family",
          taxable: true, // Interest is taxable
          tax_deductible: false,
          linked_item_type: "asset",
          linked_asset_ids: [assetId], // Use multi-select format
          percentage: interestPercent,
        };

        if (existingLinkedInterestId) {
          // Update existing income item
          console.log("Updating existing interest income item:", existingLinkedInterestId);
          await CashFlowService.update(existingLinkedInterestId, incomePayload);
        } else {
          // Create new income item
          console.log("Creating new interest income item with payload:", incomePayload);
          try {
            const result = await CashFlowService.create(incomePayload);
            console.log("Interest income item created:", result);
          } catch (error) {
            console.error("Failed to create interest income item:", error);
            alert(`Failed to create interest income item: ${error.response?.data?.detail || error.message}`);
            throw error; // Re-throw to prevent continuing
          }
        }
      } else if (!trackInterestAsIncome && existingLinkedInterestId) {
        // User unchecked the box - delete the linked income item
        try {
          await CashFlowService.delete(existingLinkedInterestId);
        } catch (deleteError) {
          console.warn("Failed to delete linked interest income item:", deleteError);
          // Continue even if deletion fails - user can delete manually
        }
      }

        // Handle dividend tracking income item (separate from asset growth)
        const dividendPercent = trackDividendsAsIncome ? parseFloat(dividendRate || 0) : null;

        if (trackDividendsAsIncome && dividendPercent > 0 && assetId) {
        // Create or update linked income item
        const incomeItemName = `${newItem.name} Dividends`;
        // Try to preserve existing category if updating, otherwise use "Dividends (qualified)"
        const existingIncome = incomeItems.find(item => item.id === existingLinkedDividendId);
        const incomeCategory = existingIncome?.category || "Dividends (qualified)";
        
        const incomePayload = {
          is_income: true,
          category: incomeCategory,
          description: incomeItemName,
          frequency: "yearly",
          value: 0, // Will be calculated dynamically
          annual_increase_percent: 0,
          inflation_percent: 0,
          person: existingIncome?.person || "Family",
          taxable: true, // Dividends are taxable
          tax_deductible: false,
          linked_item_type: "asset",
          linked_asset_ids: [assetId], // Use multi-select format
          percentage: dividendPercent,
          reinvest_dividends: true, // Automatically reinvest dividends back into the asset
          reinvestment_account_id: assetId, // Reinvest into the same asset
        };

        if (existingLinkedDividendId) {
          // Update existing income item
          console.log("Updating existing dividend income item:", existingLinkedDividendId);
          await CashFlowService.update(existingLinkedDividendId, incomePayload);
        } else {
          // Create new income item
          console.log("Creating new dividend income item with payload:", incomePayload);
          try {
            const result = await CashFlowService.create(incomePayload);
            console.log("Dividend income item created:", result);
          } catch (error) {
            console.error("Failed to create dividend income item:", error);
            alert(`Failed to create dividend income item: ${error.response?.data?.detail || error.message}`);
            throw error; // Re-throw to prevent continuing
          }
        }
      } else if (!trackDividendsAsIncome && existingLinkedDividendId) {
        // User unchecked the box - delete the linked income item
        try {
          await CashFlowService.delete(existingLinkedDividendId);
        } catch (deleteError) {
          console.warn("Failed to delete linked dividend income item:", deleteError);
          // Continue even if deletion fails - user can delete manually
        }
      }
      } // End of non-retirement account block

      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save asset item:", error);
      
      // Extract helpful error message from response
      let errorMessage = "Failed to save asset. Please try again.";
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
            const validationErrors = errorData.detail.map(err => {
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
    // Reset form state
    setNewItem({
      name: "",
      category: "",
      value: "",
      annual_increase_percent: 0,
      annual_change_type: "increase",
      account_id: null,
      start_date: "",
      end_date: "",
    });
    setTrackInterestAsIncome(false);
    setInterestRate("");
    setTrackDividendsAsIncome(false);
    setDividendRate("");
    setRetirementInterestRate("");
    setRetirementDividendRate("");
    setExistingLinkedInterestId(null);
    setExistingLinkedDividendId(null);
    setWarningMessage("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.name}` : `Add New Asset`}>
      <div className="asset-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}> {/* First row: Name, Category, Account, Value */} 
            <div className="form-field">
              <label htmlFor="asset-name">Name *</label>
              <input
                id="asset-name"
                type="text"
                placeholder="Name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="asset-category">Category *</label>
              <select id="asset-category" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="asset-account">Account</label>
              <select 
                id="asset-account" 
                value={newItem.account_id || ''} 
                onChange={(e) => setNewItem({ ...newItem, account_id: e.target.value ? parseInt(e.target.value) : null })}
              >
                <option value="">None</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.brokerage} - {account.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="asset-value">Value *</label>
              <input
                id="asset-value"
                type="text"
                placeholder="Value"
                value={newItem.value ? formatNumber(newItem.value) : ""}
                onFocus={(e) => {
                  e.target.select();
                  // Remove commas when focused for easier editing
                  const numericValue = parseNumber(e.target.value);
                  setNewItem({ ...newItem, value: numericValue });
                  e.target.value = numericValue;
                }}
                onChange={(e) => {
                  const numericValue = parseNumber(e.target.value);
                  setNewItem({ ...newItem, value: numericValue });
                }}
                onBlur={(e) => {
                  // Format with commas when user leaves the field
                  const numericValue = parseNumber(e.target.value);
                  setNewItem({ ...newItem, value: numericValue });
                  e.target.value = numericValue ? formatNumber(numericValue) : "";
                }}
              />
            </div>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: isRetirementAccount ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: '12px' }}> {/* Second row: Percent, Annual Change, Start Date, End Date (and Total Growth Rate for retirement) */} 
            <div className="form-field">
              <label htmlFor="annual-change-percent">Internal Growth Rate (%)</label>
              <input
                id="annual-change-percent"
                type="number"
                step="0.1"
                placeholder="Growth Rate"
                value={newItem.annual_increase_percent}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNewItem({ ...newItem, annual_increase_percent: parseFloat(e.target.value) || 0 })}
                title="The asset's internal growth rate (e.g., equity appreciation)"
              />
            </div>
            
            {isRetirementAccount && (
              <div className="form-field">
                <label htmlFor="total-growth-rate">Total Growth Rate (%)</label>
                <input
                  id="total-growth-rate"
                  type="text"
                  value={(parseFloat(newItem.annual_increase_percent || 0) + parseFloat(retirementInterestRate || 0) + parseFloat(retirementDividendRate || 0)).toFixed(1)}
                  readOnly
                  disabled
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  title="Calculated total: Internal Growth Rate + Interest Rate + Dividend Rate"
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="annual-change-type">Annual Change</label>
              <select id="annual-change-type" value={newItem.annual_change_type} onChange={(e) => setNewItem({ ...newItem, annual_change_type: e.target.value })}>
                <option value="">Select Change Type</option>
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="asset-start-date">Start Date</label>
              <input
                id="asset-start-date"
                type="date"
                placeholder="Start Date"
                value={newItem.start_date}
                onChange={(e) => setNewItem({ ...newItem, start_date: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="asset-end-date">End Date</label>
              <input
                id="asset-end-date"
                type="date"
                placeholder="End Date"
                value={newItem.end_date || ""}
                onChange={(e) => setNewItem({ ...newItem, end_date: e.target.value })}
              />
            </div>
          </div>

          {!isRetirementAccount && (
            <>
              <div className="form-row" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1' }}>
                  <input
                    id="track-interest-as-income"
                    type="checkbox"
                    checked={trackInterestAsIncome}
                    onChange={(e) => {
                      setTrackInterestAsIncome(e.target.checked);
                      if (!e.target.checked) {
                        setInterestRate(""); // Clear interest rate when unchecked
                      }
                    }}
                  />
                  <label htmlFor="track-interest-as-income" style={{ margin: 0, cursor: 'pointer' }}>
                    Track Interest as Taxable Income
                  </label>
                </div>
                {trackInterestAsIncome && (
                  <div className="form-field" style={{ minWidth: '150px' }}>
                    <label htmlFor="interest-rate">Interest Rate (%)</label>
                    <input
                      id="interest-rate"
                      type="number"
                      step="0.1"
                      placeholder="Interest Rate"
                      value={interestRate}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setInterestRate(e.target.value)}
                      title="Interest rate as a percentage of the asset's total value (e.g., 1.5% for interest income)"
                    />
                  </div>
                )}
              </div>

              <div className="form-row" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1' }}>
                  <input
                    id="track-dividends-as-income"
                    type="checkbox"
                    checked={trackDividendsAsIncome}
                    onChange={(e) => {
                      setTrackDividendsAsIncome(e.target.checked);
                      if (!e.target.checked) {
                        setDividendRate(""); // Clear dividend rate when unchecked
                      }
                    }}
                  />
                  <label htmlFor="track-dividends-as-income" style={{ margin: 0, cursor: 'pointer' }}>
                    Track Dividends as Taxable Income
                  </label>
                </div>
                {trackDividendsAsIncome && (
                  <div className="form-field" style={{ minWidth: '150px' }}>
                    <label htmlFor="dividend-rate">Dividend Rate (%)</label>
                    <input
                      id="dividend-rate"
                      type="number"
                      step="0.1"
                      placeholder="Dividend Rate"
                      value={dividendRate}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDividendRate(e.target.value)}
                      title="Dividend rate as a percentage of the asset's total value (e.g., 2% for dividend yield)"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {isRetirementAccount ? (
            <>
              {/* Retirement account: Interest and Dividends are reinvested (not taxable) */}
              <div className="form-row" style={{ marginTop: '12px' }}>
                <div className="form-field">
                  <label htmlFor="retirement-interest-rate">Interest Rate (%)</label>
                  <input
                    id="retirement-interest-rate"
                    type="number"
                    step="0.1"
                    placeholder="Interest Rate"
                    value={retirementInterestRate}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setRetirementInterestRate(e.target.value)}
                    title="Interest rate that will be added to the asset's growth (reinvested, not taxable)"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="retirement-dividend-rate">Dividend Rate (%)</label>
                  <input
                    id="retirement-dividend-rate"
                    type="number"
                    step="0.1"
                    placeholder="Dividend Rate"
                    value={retirementDividendRate}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setRetirementDividendRate(e.target.value)}
                    title="Dividend rate that will be added to the asset's growth (reinvested, not taxable)"
                  />
                </div>
              </div>
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                backgroundColor: '#e7f3ff', 
                borderRadius: '4px',
                fontSize: '0.9rem',
                color: '#0066cc'
              }}>
                For retirement accounts, interest and dividends are automatically reinvested and are not tracked as taxable income. The Total Growth Rate above shows the sum (Internal Growth Rate + Interest Rate + Dividend Rate) and is used in calculations.
              </div>
            </>
          ) : (
            (trackInterestAsIncome || trackDividendsAsIncome) && (
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                backgroundColor: '#e7f3ff', 
                borderRadius: '4px',
                fontSize: '0.9rem',
                color: '#0066cc'
              }}>
                When enabled, linked income items will be created/updated to track interest/dividends as taxable income. The Internal Growth Rate above represents the asset's appreciation (e.g., equity growth), while the Interest/Dividend Rates represent income generated.
              </div>
            )
          )}

          <div className="form-actions">
            <button onClick={save} id="add-asset-item-button">
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
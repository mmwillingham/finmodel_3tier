import React, { useState, useEffect } from "react";
import AssetService from "../services/asset.service";
import SettingsService from "../services/settings.service";
import AccountService from "../services/account.service";
import CashFlowService from "../services/cashflow.service";
import Modal from "./Modal"; // Import the generic Modal component
import "./AssetFormModal.css"; // Specific styling for this form

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
  const [existingLinkedIncomeId, setExistingLinkedIncomeId] = useState(null);
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

          // Check if there's an existing income item linked to this asset
          const linkedIncome = incomeRes.data?.find(item => 
            item.linked_item_type === "asset" && 
            (item.linked_item_id === itemToEdit.id || 
             (item.linked_asset_ids && item.linked_asset_ids.includes(itemToEdit.id)))
          );
          
          if (linkedIncome) {
            setTrackInterestAsIncome(true);
            setExistingLinkedIncomeId(linkedIncome.id);
            // Use the income item's percentage if it exists, otherwise use asset's growth
            const interestPercent = linkedIncome.percentage ?? itemToEdit.annual_increase_percent ?? 0;
            setNewItem(prev => ({
              ...prev,
              annual_increase_percent: interestPercent,
            }));
            // If asset has growth percent and linked income exists, show warning
            if (itemToEdit.annual_increase_percent > 0 && itemToEdit.annual_increase_percent !== interestPercent) {
              setWarningMessage(
                `Warning: This asset has ${itemToEdit.annual_increase_percent}% growth AND a linked income item at ${interestPercent}%. This may cause double-counting. Asset growth will be set to 0% when saved.`
              );
            }
          } else {
            setTrackInterestAsIncome(false);
            setExistingLinkedIncomeId(null);
            setWarningMessage("");
          }
        } else {
          setNewItem(prev => ({
            ...prev,
            name: "",
            category: "",
            value: "",
            annual_increase_percent: 0,
            annual_change_type: "increase",
            account_id: null,
            start_date: "",
            end_date: "",
          }));
          setTrackInterestAsIncome(false);
          setExistingLinkedIncomeId(null);
          setWarningMessage("");
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

  // Check for validation warnings
  useEffect(() => {
    if (trackInterestAsIncome && parseFloat(newItem.annual_increase_percent || 0) > 0) {
      setWarningMessage(
        `Warning: Asset has ${newItem.annual_increase_percent}% growth AND interest tracking is enabled. This may cause double-counting. Consider setting asset growth to 0% if tracking interest as income.`
      );
    } else if (!trackInterestAsIncome && existingLinkedIncomeId) {
      // User unchecked the box but linked income exists - will be handled in save
      setWarningMessage("");
    } else {
      setWarningMessage("");
    }
  }, [trackInterestAsIncome, newItem.annual_increase_percent, existingLinkedIncomeId]);

  const save = async () => {
    if (!newItem.name || !newItem.category || !newItem.value || !newItem.annual_change_type) return;

    const assetPayload = {
      name: newItem.name,
      category: newItem.category,
      value: parseFloat(newItem.value),
      annual_increase_percent: trackInterestAsIncome ? 0 : parseFloat(newItem.annual_increase_percent || 0),
      annual_change_type: newItem.annual_change_type,
      account_id: newItem.account_id || null,
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
        assetId = savedAsset.data?.id;
      }

      // Handle interest tracking income item
      const interestPercent = trackInterestAsIncome ? parseFloat(newItem.annual_increase_percent || 0) : null;

      if (trackInterestAsIncome && interestPercent > 0 && assetId) {
        // Create or update linked income item
        const incomeItemName = `${newItem.name} Interest`;
        // Try to preserve existing category if updating, otherwise use "Interest"
        const existingIncome = incomeItems.find(item => item.id === existingLinkedIncomeId);
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

        if (existingLinkedIncomeId) {
          // Update existing income item
          await CashFlowService.update(existingLinkedIncomeId, incomePayload);
        } else {
          // Create new income item
          await CashFlowService.create(incomePayload);
        }
      } else if (!trackInterestAsIncome && existingLinkedIncomeId) {
        // User unchecked the box - delete the linked income item
        try {
          await CashFlowService.delete(existingLinkedIncomeId);
        } catch (deleteError) {
          console.warn("Failed to delete linked income item:", deleteError);
          // Continue even if deletion fails - user can delete manually
        }
      }

      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save asset item:", error);
      alert(`Failed to save asset: ${error.response?.data?.detail || error.message}`);
    }
  };

  const cancelEdit = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.name}` : `Add New Asset`}>
      <div className="asset-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}> {/* First row: Name, Category, Account, Value */} 
            <div className="form-field">
              <label htmlFor="asset-name">Name</label>
              <input
                id="asset-name"
                type="text"
                placeholder="Name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="asset-category">Category</label>
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
              <label htmlFor="asset-value">Value</label>
              <input
                id="asset-value"
                type="number"
                placeholder="Value"
                value={newItem.value}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}> {/* Second row: Percent, Annual Change, Start Date, End Date */} 
            <div className="form-field">
              <label htmlFor="annual-change-percent">
                {trackInterestAsIncome ? "Interest Rate (%)" : "Percent"}
              </label>
              <input
                id="annual-change-percent"
                type="number"
                step="0.1"
                placeholder={trackInterestAsIncome ? "Interest Rate" : "Percent"}
                value={newItem.annual_increase_percent}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNewItem({ ...newItem, annual_increase_percent: e.target.value })}
                title={trackInterestAsIncome ? "This will be used as the interest rate for the income item. Asset growth will be set to 0%." : ""}
              />
            </div>

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

          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="track-interest-as-income"
                type="checkbox"
                checked={trackInterestAsIncome}
                onChange={(e) => setTrackInterestAsIncome(e.target.checked)}
              />
              <label htmlFor="track-interest-as-income" style={{ margin: 0, cursor: 'pointer' }}>
                Track Interest as Taxable Income
              </label>
            </div>
          </div>

          {trackInterestAsIncome && (
            <div style={{ 
              marginTop: '8px', 
              padding: '8px', 
              backgroundColor: '#e7f3ff', 
              borderRadius: '4px',
              fontSize: '0.9rem',
              color: '#0066cc'
            }}>
              When enabled, asset growth will be set to 0% and a linked income item will be created/updated to track interest as taxable income. The interest rate you enter above will be used for the income item.
            </div>
          )}

          {warningMessage && (
            <div style={{ 
              marginTop: '8px', 
              padding: '8px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '4px',
              fontSize: '0.9rem',
              color: '#856404',
              borderLeft: '4px solid #ffc107'
            }}>
              {warningMessage}
            </div>
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
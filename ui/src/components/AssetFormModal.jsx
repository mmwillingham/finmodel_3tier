import React, { useState, useEffect } from "react";
import AssetService from "../services/asset.service";
import SettingsService from "../services/settings.service";
import Modal from "./Modal"; // Import the generic Modal component
import "./AssetFormModal.css"; // Specific styling for this form

export default function AssetFormModal({
  isOpen,
  onClose,
  item: itemToEdit,
  onSaveSuccess,
}) {
  const [categories, setCategories] = useState([]);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    value: "",
    annual_increase_percent: 0,
    annual_change_type: "increase", // Default to increase for assets
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await SettingsService.getSettings();
        const cats = res.data.asset_categories?.split(",") || [];
        setCategories(cats);

        if (itemToEdit) {
          setNewItem({
            name: itemToEdit.name || '',
            category: itemToEdit.category || '',
            value: itemToEdit.value.toString() || '',
            annual_increase_percent: itemToEdit.annual_increase_percent || 0,
            annual_change_type: itemToEdit.annual_change_type || "increase",
            start_date: itemToEdit.start_date || '',
            end_date: itemToEdit.end_date || '',
          });
        } else {
          setNewItem(prev => ({
            ...prev,
            name: "",
            category: "",
            value: "",
            annual_increase_percent: 0,
            annual_change_type: "increase",
            start_date: "",
            end_date: "",
          }));
        }
      } catch (e) {
        console.error("Failed to load settings", e);
        setCategories([]);
        if (!itemToEdit) {
          setNewItem(prev => ({ ...prev, category: "", annual_change_type: "increase" }));
        }
      }
    };
    loadSettings();
  }, [itemToEdit]);

  const save = async () => {
    if (!newItem.name || !newItem.category || !newItem.value || !newItem.annual_change_type) return;

    const payload = {
      name: newItem.name,
      category: newItem.category,
      value: parseFloat(newItem.value),
      annual_increase_percent: parseFloat(newItem.annual_increase_percent || 0),
      annual_change_type: newItem.annual_change_type,
      start_date: newItem.start_date || null,
      end_date: newItem.end_date || null,
    };

    try {
      if (itemToEdit) {
        await AssetService.update(itemToEdit.id, payload);
      } else {
        await AssetService.create(payload);
      }
      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save asset item:", error);
      // Optionally, show an error message to the user
    }
  };

  const cancelEdit = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.name}` : `Add New Asset`}>
      <div className="asset-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}> {/* First row: Name, Category, Value, Percent, Annual Change */} 
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

            <div className="form-field">
              <label htmlFor="annual-change-percent">Percent</label>
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
              <label htmlFor="annual-change-type">Annual Change</label>
              <select id="annual-change-type" value={newItem.annual_change_type} onChange={(e) => setNewItem({ ...newItem, annual_change_type: e.target.value })}>
                <option value="">Select Change Type</option>
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
              </select>
            </div>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) 1fr 1fr 1fr' }}> {/* Second row: Start Date, End Date, with 3 empty columns */} 
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
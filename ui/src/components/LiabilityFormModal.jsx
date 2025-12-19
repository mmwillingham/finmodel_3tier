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
    <Modal isOpen={isOpen} onClose={cancelEdit} title={itemToEdit ? `Edit ${itemToEdit.name}` : `Add New Liability`}>
      <div className="liability-form-modal-content">
        <div className="add-item-form">
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}> {/* First row: Name, Category, Value, Percent, Annual Change */} 
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
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
              </select>
            </div>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) 1fr 1fr 1fr' }}> {/* Second row: Start Date, End Date, with 3 empty columns */} 
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

            <div className="form-field">
              <label htmlFor="liability-end-date">End Date</label>
              <input
                id="liability-end-date"
                type="date"
                placeholder="End Date"
                value={newItem.end_date || ""}
                onChange={(e) => setNewItem({ ...newItem, end_date: e.target.value })}
              />
            </div>
          </div>

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
import React, { useState, useEffect } from 'react';
import './SettingsModal.css'; // Reusing some modal styles

export default function CategoryEditorModal({ isOpen, onClose, onSave, categories: initialCategories, title }) {
  const [currentCategories, setCurrentCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentCategories(initialCategories || []);
      setNewCategory('');
      setEditingIndex(null);
      setEditingText('');
    }
  }, [isOpen, initialCategories]);

  const handleAddCategory = () => {
    if (newCategory.trim() && !currentCategories.includes(newCategory.trim())) {
      setCurrentCategories([...currentCategories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleEditClick = (index, category) => {
    setEditingIndex(index);
    setEditingText(category);
  };

  const handleSaveEdit = (index) => {
    if (editingText.trim() && !currentCategories.includes(editingText.trim()) || editingIndex === index) {
      const updatedCategories = currentCategories.map((cat, i) =>
        i === index ? editingText.trim() : cat
      );
      setCurrentCategories(updatedCategories);
      setEditingIndex(null);
      setEditingText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingText('');
  };

  const handleRemoveCategory = (indexToRemove) => {
    setCurrentCategories(currentCategories.filter((_, index) => index !== indexToRemove));
  };

  const handleModalSave = () => {
    onSave(currentCategories);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal category-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Manage {title}</h3>

        <div className="category-list">
          {currentCategories.map((category, index) => (
            <div key={index} className="category-item">
              {editingIndex === index ? (
                <>
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleSaveEdit(index);
                        }
                    }}
                  />
                  <button onClick={() => handleSaveEdit(index)}>Save</button>
                  <button onClick={handleCancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <span onClick={() => handleEditClick(index, category)}>{category}</span>
                  <button onClick={() => handleRemoveCategory(index)}>x</button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="add-category-form">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyPress={(e) => {
                if (e.key === 'Enter') {
                    handleAddCategory();
                }
            }}
            placeholder="Add new category"
          />
          <button onClick={handleAddCategory}>Add</button>
        </div>

        <div className="modal-actions">
          <button onClick={handleModalSave}>Save Changes</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import SettingsService from '../services/settings.service'; // NEW: Import SettingsService
import './CategoryEditorModal.css'; // CORRECTED: Import CategoryEditorModal's own CSS

// Helper function to reorder arrays
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

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
    } else {
      // Reset categories when modal closes to ensure fresh load next time it opens
      setCurrentCategories([]); 
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
    if (editingText.trim() && (!currentCategories.includes(editingText.trim()) || editingIndex === index)) {
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

  const handleRemoveCategory = async (indexToRemove) => {
    const categoryToDelete = currentCategories[indexToRemove];
    const categoryType = title.split(' ')[0].toLowerCase(); // e.g., "Asset Categories" -> "asset"
    try {
      const response = await SettingsService.checkCategoryUsage(categoryToDelete, categoryType);
      console.log('Raw response from checkCategoryUsage:', response);
      const isInUse = response.data;
      if (isInUse) {
        alert(`Cannot delete "${categoryToDelete}" as it is currently in use.`);
        return;
      }
    } catch (error) {
      console.error('Error checking category usage:', error);
      alert('Failed to check category usage. Please try again.');
      return;
    }

    setCurrentCategories(currentCategories.filter((_, index) => index !== indexToRemove));
  };

  const onDragEnd = (result) => {
    if (!result.destination) {
      return;
    }

    const items = reorder(
      currentCategories,
      result.source.index,
      result.destination.index
    );

    setCurrentCategories(items);
  };

  const handleModalSave = () => {
    onSave(currentCategories);
    onClose();
  };

  if (!isOpen) return null;

  // Render the modal using a Portal to ensure it's outside the main DOM flow
  return createPortal(
    <div className="category-editor-modal-overlay" onClick={onClose}>
      <div className="category-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Manage {title}</h3>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="droppable-categories">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="category-list"
              >
                {currentCategories.map((category, index) => (
                  <Draggable key={category} draggableId={category} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          ...provided.draggableProps.style,
                          userSelect: 'none',
                          backgroundColor: snapshot.isDragging ? '#f0f0f0' : 'white',
                          border: snapshot.isDragging ? '1px dashed #ccc' : '1px solid #eee',
                          borderRadius: '4px',
                          margin: '0 0 8px 0',
                          padding: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        className="category-item"
                      >
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
                            <button onClick={() => handleCancelEdit()}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <span onClick={() => handleEditClick(index, category)}>{category}</span>
                            <button onClick={() => handleRemoveCategory(index)}>x</button>
                          </>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

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
          <button onClick={() => handleAddCategory()}>Add</button>
        </div>

        <div className="modal-actions">
          <button onClick={handleModalSave}>Save Changes</button>
          <button onClick={() => onClose()}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
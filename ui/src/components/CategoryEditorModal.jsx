import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './SettingsModal.css'; // Reusing some modal styles

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

  const handleRemoveCategory = (indexToRemove) => {
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

  return (
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
  );
}

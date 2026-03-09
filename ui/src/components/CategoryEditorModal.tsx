import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import SettingsService from '../services/settings.service'; // NEW: Import SettingsService
import { projectionActionButtonSx, projectionSecondaryButtonSx } from "../utils/projectionUiStyles";
import './CategoryEditorModal.css'; // CORRECTED: Import CategoryEditorModal's own CSS

// Helper function to reorder arrays
const reorder = (list: any, startIndex: any, endIndex: any) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

export default function CategoryEditorModal({ isOpen, onClose, onSave, categories: initialCategories, title }: any) {
  const [currentCategories, setCurrentCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState<any>(null);
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

  const handleEditClick = (index: any, category: any) => {
    setEditingIndex(index);
    setEditingText(category);
  };

  const handleSaveEdit = (index: any) => {
    if (editingText.trim() && (!currentCategories.includes(editingText.trim()) || editingIndex === index)) {
      const updatedCategories = currentCategories.map((cat: any, i: any) =>
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

  const handleRemoveCategory = async (indexToRemove: any) => {
    const categoryToDelete = currentCategories[indexToRemove];
    const categoryType = title.split(' ')[0].toLowerCase(); // e.g., "Asset Categories" -> "asset"
    try {
      const response = await SettingsService.checkCategoryUsage(categoryToDelete, categoryType);
      const isInUse = response.data;
      if (isInUse) {
        alert(`Cannot delete "${categoryToDelete}" as it is currently in use.`);
        return;
      }
    } catch (error: any) {
      alert('Failed to check category usage. Please try again.');
      return;
    }

    setCurrentCategories(currentCategories.filter((_: any, index: any) => index !== indexToRemove));
  };

  const onDragEnd = (result: any) => {
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

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ className: "category-editor-modal", sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ pb: 0.5, textAlign: "center", fontSize: "1.25rem", fontWeight: 700 }}>
        Manage {title}
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Click a category to rename it
        </Typography>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="droppable-categories">
            {(provided: any) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="category-list"
              >
                {currentCategories.map((category: any, index: any) => (
                  <Draggable key={category} draggableId={category} index={index}>
                    {(provided: any, snapshot: any) => (
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
                            <TextField
                              size="small"
                              value={editingText}
                              onChange={(e: any) => setEditingText(e.target.value)}
                              onKeyDown={(e: any) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit(index);
                                }
                              }}
                            />
                            <Button size="small" variant="contained" sx={{ ...projectionActionButtonSx, minWidth: 72 }} onClick={() => handleSaveEdit(index)}>Save</Button>
                            <Button size="small" variant="outlined" sx={{ ...projectionSecondaryButtonSx, minWidth: 72 }} onClick={() => handleCancelEdit()}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Typography component="span" onClick={() => handleEditClick(index, category)} sx={{ flexGrow: 1, cursor: "pointer", px: 0.5 }}>
                              {category}
                            </Typography>
                            <Button size="small" variant="outlined" sx={{ ...projectionSecondaryButtonSx, minWidth: 36, width: 36, p: 0 }} onClick={() => handleRemoveCategory(index)}>x</Button>
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

        <Stack className="add-category-form" direction="row" spacing={1.25} alignItems="center">
          <TextField
            size="small"
            fullWidth
            value={newCategory}
            onChange={(e: any) => setNewCategory(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter') {
                handleAddCategory();
              }
            }}
            placeholder="Add new category"
          />
          <Button variant="contained" sx={{ ...projectionActionButtonSx, minWidth: 80 }} onClick={() => handleAddCategory()}>Add</Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Button variant="contained" sx={projectionActionButtonSx} onClick={handleModalSave}>Save Changes</Button>
        <Button variant="outlined" sx={projectionSecondaryButtonSx} onClick={() => onClose()}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
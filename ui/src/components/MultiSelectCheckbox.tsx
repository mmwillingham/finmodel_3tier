import React, { useState, useRef, useEffect } from 'react';
import './MultiSelectCheckbox.css';

/**
 * A user-friendly multi-select component using checkboxes
 * @param {Array} options - Array of objects with {id, name, category} or {id, label}
 * @param {Array} selectedValues - Array of selected IDs
 * @param {Function} onChange - Callback with (selectedIds) when selection changes
 * @param {String} placeholder - Placeholder text when no items selected
 * @param {Boolean} disabled - Whether the component is disabled
 * @param {Number} maxHeight - Maximum height in pixels for the dropdown
 * @param {Boolean} showCategory - Whether to show category in the label
 */
export default function MultiSelectCheckbox({
  options = [],
  selectedValues = [],
  onChange,
  placeholder = "Select items...",
  disabled = false,
  maxHeight = 300,
  showCategory = false,
}: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownHeight, setDropdownHeight] = useState(200);
  const containerRef = useRef<any>(null);
  const dropdownRef = useRef<any>(null);
  const resizeHandleRef = useRef<any>(null);
  const isResizingRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      // Don't close if we're resizing
      if (isResizingRef.current) return;
      
      // Don't close if clicking on the resize handle
      if (resizeHandleRef.current && resizeHandleRef.current.contains(event.target)) return;
      
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Resize functionality is handled directly in handleResizeStart

  const handleResizePointerStart = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) {
      e.stopImmediatePropagation();
    }

    isResizingRef.current = true;
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = dropdownHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: any) => {
      if (!isResizingRef.current) return;
      const deltaY = moveEvent.clientY - resizeStartYRef.current;
      const newHeight = resizeStartHeightRef.current + deltaY;
      const minHeight = 150;
      const maxHeight = 500;
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setDropdownHeight(newHeight);
      }
    };

    const handlePointerUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: false });
  };

  const toggleOption = (id: any) => {
    if (disabled) return;
    
    const newSelected = selectedValues.includes(id)
      ? selectedValues.filter((v: any) => v !== id)
      : [...selectedValues, id];
    
    onChange(newSelected);
  };

  const toggleAll = () => {
    if (disabled) return;
    
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map((opt: any) => opt.id));
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (selectedValues.length === 1) {
      const selected = options.find((opt: any) => opt.id === selectedValues[0]);
      if (selected) {
        return showCategory && selected.category 
          ? `${selected.name || selected.label} (${selected.category})`
          : (selected.name || selected.label);
      }
      return `${selectedValues.length} item selected`;
    }
    return `${selectedValues.length} items selected`;
  };

  const getOptionLabel = (option: any) => {
    if (showCategory && option.category) {
      return `${option.name || option.label} (${option.category})`;
    }
    return option.name || option.label || option.brokerage ? `${option.brokerage} - ${option.account_name}` : String(option.id);
  };

  return (
    <div className="multi-select-checkbox-container" ref={containerRef}>
      <div
        className={`multi-select-checkbox-trigger ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="multi-select-checkbox-value">{getDisplayText()}</span>
        <span className="multi-select-checkbox-arrow">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>
      
      {isOpen && !disabled && (
        <div 
          ref={dropdownRef}
          className="multi-select-checkbox-dropdown"
          style={{ height: `${dropdownHeight}px`, maxHeight: `${maxHeight}px` }}
        >
          {options.length > 0 && (
            <div className="multi-select-checkbox-header">
              <label className="multi-select-checkbox-select-all">
                <input
                  type="checkbox"
                  checked={selectedValues.length === options.length && options.length > 0}
                  onChange={toggleAll}
                  onClick={(e: any) => e.stopPropagation()}
                />
                <span>Select All</span>
              </label>
            </div>
          )}
          
          <div className="multi-select-checkbox-options">
            {options.length === 0 ? (
              <div className="multi-select-checkbox-empty">No options available</div>
            ) : (
              options.map((option: any) => {
                const isSelected = selectedValues.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={`multi-select-checkbox-option ${isSelected ? 'selected' : ''}`}
                    onClick={(e: any) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(option.id)}
                      onClick={(e: any) => e.stopPropagation()}
                    />
                    <span>{getOptionLabel(option)}</span>
                  </label>
                );
              })
            )}
          </div>
          <div 
            ref={resizeHandleRef}
            className="multi-select-checkbox-resize-handle"
            onPointerDown={handleResizePointerStart}
          />
        </div>
      )}
    </div>
  );
}

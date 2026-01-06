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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
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

  const toggleOption = (id) => {
    if (disabled) return;
    
    const newSelected = selectedValues.includes(id)
      ? selectedValues.filter(v => v !== id)
      : [...selectedValues, id];
    
    onChange(newSelected);
  };

  const toggleAll = () => {
    if (disabled) return;
    
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.id));
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (selectedValues.length === 1) {
      const selected = options.find(opt => opt.id === selectedValues[0]);
      if (selected) {
        return showCategory && selected.category 
          ? `${selected.name || selected.label} (${selected.category})`
          : (selected.name || selected.label);
      }
      return `${selectedValues.length} item selected`;
    }
    return `${selectedValues.length} items selected`;
  };

  const getOptionLabel = (option) => {
    if (showCategory && option.category) {
      return `${option.name || option.label} (${option.category})`;
    }
    return option.name || option.label || option.broker ? `${option.broker} - ${option.account_name}` : String(option.id);
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
          className="multi-select-checkbox-dropdown"
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {options.length > 0 && (
            <div className="multi-select-checkbox-header">
              <label className="multi-select-checkbox-select-all">
                <input
                  type="checkbox"
                  checked={selectedValues.length === options.length && options.length > 0}
                  onChange={toggleAll}
                  onClick={(e) => e.stopPropagation()}
                />
                <span>Select All</span>
              </label>
            </div>
          )}
          
          <div className="multi-select-checkbox-options">
            {options.length === 0 ? (
              <div className="multi-select-checkbox-empty">No options available</div>
            ) : (
              options.map((option) => {
                const isSelected = selectedValues.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={`multi-select-checkbox-option ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(option.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span>{getOptionLabel(option)}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

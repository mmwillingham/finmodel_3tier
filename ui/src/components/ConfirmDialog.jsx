import React, { useState } from 'react';
import './ConfirmDialog.css';

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "OK", 
  cancelText = "Cancel",
  showCancel = false,
  showCascadeOption = false,
  cascadeMessage = "Also delete linked items"
}) => {
  const [cascadeDelete, setCascadeDelete] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(showCascadeOption ? cascadeDelete : undefined);
    onClose();
    // Reset cascade option when dialog closes
    setCascadeDelete(false);
  };

  const handleCancel = () => {
    onClose();
    // Reset cascade option when dialog closes
    setCascadeDelete(false);
  };

  return (
    <div className="confirm-dialog-overlay" onClick={onClose}>
      <div className="confirm-dialog-content" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="confirm-dialog-header">
            <h3>{title}</h3>
          </div>
        )}
        <div className="confirm-dialog-body">
          <p style={{ whiteSpace: 'pre-line' }}>{message}</p>
          {showCascadeOption && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={cascadeDelete}
                  onChange={(e) => setCascadeDelete(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.95em' }}>{cascadeMessage}</span>
              </label>
            </div>
          )}
        </div>
        <div className="confirm-dialog-footer">
          {showCancel && (
            <button className="confirm-dialog-button confirm-dialog-cancel" onClick={handleCancel}>
              {cancelText}
            </button>
          )}
          <button className="confirm-dialog-button confirm-dialog-confirm" onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

import React from 'react';
import './ConfirmDialog.css';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = "OK", cancelText = "Cancel" }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
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
          <p>{message}</p>
        </div>
        <div className="confirm-dialog-footer">
          <button className="confirm-dialog-button confirm-dialog-cancel" onClick={handleCancel}>
            {cancelText}
          </button>
          <button className="confirm-dialog-button confirm-dialog-confirm" onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

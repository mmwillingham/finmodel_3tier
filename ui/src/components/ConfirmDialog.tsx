import React, { useState } from 'react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cascade?: boolean) => void;
  onRetain?: (cascade?: boolean) => void;
  title?: string;
  message: string;
  confirmText?: string;
  retainText?: string;
  cancelText?: string;
  showCancel?: boolean;
  showRetain?: boolean;
  showCascadeOption?: boolean;
  cascadeMessage?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onRetain,
  title,
  message,
  confirmText = 'Delete',
  retainText = 'Retain',
  cancelText = 'Cancel',
  showCancel = false,
  showRetain = false,
  showCascadeOption = false,
  cascadeMessage = 'Also delete linked items',
}) => {
  const [cascadeDelete, setCascadeDelete] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(showCascadeOption ? cascadeDelete : undefined);
    onClose();
    // Reset cascade option when dialog closes
    setCascadeDelete(false);
  };

  const handleRetain = () => {
    if (onRetain) {
      onRetain(showCascadeOption ? cascadeDelete : undefined);
    }
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
      <div className="confirm-dialog-content" onClick={(e: any) => e.stopPropagation()}>
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
                  onChange={(e: any) => setCascadeDelete(e.target.checked)}
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
          {showRetain && onRetain && (
            <button className="confirm-dialog-button confirm-dialog-retain" onClick={handleRetain}>
              {retainText}
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

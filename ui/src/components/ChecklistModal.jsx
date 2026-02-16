import React, { useEffect, useState } from 'react';
import PointsService from '../services/points.service';
import './ChecklistModal.css';

const checklistItems = [
  { key: 'has_account', label: 'Account' },
  { key: 'has_asset', label: 'Asset' },
  { key: 'has_cash_flow_item', label: 'Cash Flow Item' },
  { key: 'has_referral_sent', label: 'Referral Sent' },
  { key: 'has_document_folder', label: 'Document Folder (in Document Vault)' },
  { key: 'has_document', label: 'Document (in Document Vault)' },
  { key: 'has_connected_account', label: 'Connected Account' },
  { key: 'has_surplus_asset_account', label: 'Surplus Asset Account' },
  { key: 'has_auto_disbursement', label: 'Auto-Disbursement' },
  { key: 'mfa_enabled', label: 'MFA enabled' },
  { key: 'federal_tax_enabled', label: 'Federal tax calculations enabled' },
  { key: 'cash_handling_enabled', label: 'Cash Handling enabled' },
  { key: 'social_security_enabled', label: 'Social Security income enabled' }
];

const ChecklistModal = ({ isOpen, onClose }) => {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchChecklist();
    }
  }, [isOpen]);

  const fetchChecklist = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await PointsService.getChecklist();
      setChecklist(data);
    } catch (err) {
      setError('Failed to load checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="checklist-modal-overlay" onClick={onClose}>
      <div className="checklist-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="checklist-modal-header">
          <h2>✅ Your Checklist</h2>
          <button className="checklist-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="checklist-modal-body">
          {loading && <div className="checklist-loading">Loading...</div>}
          {error && <div className="checklist-error">{error}</div>}
          {checklist && !loading && (
            <div className="checklist-grid">
              {checklistItems.map((item) => (
                <div className="checklist-row" key={item.key}>
                  <div className="checklist-label">{item.label}</div>
                  <div className="checklist-status">
                    {checklist[item.key] ? <span className="checklist-check">✅</span> : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistModal;

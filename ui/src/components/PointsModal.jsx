import React, { useState, useEffect } from 'react';
import PointsService from '../services/points.service';
import './PointsModal.css';

const PointsModal = ({ isOpen, onClose }) => {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchPoints();
    }
  }, [isOpen]);

  const fetchPoints = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await PointsService.getPoints();
      setPoints(data);
    } catch (err) {
      setError('Failed to load points. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="points-modal-overlay" onClick={onClose}>
      <div className="points-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="points-modal-header">
          <h2>⭐ Your Points</h2>
          <button className="points-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="points-modal-body">
          {loading && <div className="points-loading">Loading...</div>}
          {error && <div className="points-error">{error}</div>}
          {points && !loading && (
            <>
              <div className="points-total">
                <span className="points-total-label">Total Points:</span>
                <span className="points-total-value">{points.total_points.toLocaleString()}</span>
              </div>
              <div className="points-breakdown">
                <h3>Breakdown</h3>
                <div className="points-breakdown-item">
                  <span className="points-breakdown-label">Accounts:</span>
                  <span className="points-breakdown-value">{points.breakdown.accounts} × 10 = {points.breakdown.accounts * 10} pts</span>
                </div>
                <div className="points-breakdown-item">
                  <span className="points-breakdown-label">Assets:</span>
                  <span className="points-breakdown-value">{points.breakdown.assets} × 15 = {points.breakdown.assets * 15} pts</span>
                </div>
                <div className="points-breakdown-item">
                  <span className="points-breakdown-label">Liabilities:</span>
                  <span className="points-breakdown-value">{points.breakdown.liabilities} × 10 = {points.breakdown.liabilities * 10} pts</span>
                </div>
                <div className="points-breakdown-item">
                  <span className="points-breakdown-label">Cash Flow Items:</span>
                  <span className="points-breakdown-value">{points.breakdown.cashflow_items} × 5 = {points.breakdown.cashflow_items * 5} pts</span>
                </div>
                <div className="points-breakdown-item">
                  <span className="points-breakdown-label">Referrals Sent:</span>
                  <span className="points-breakdown-value">{points.breakdown.referrals_sent} × 25 = {points.breakdown.referrals_sent * 25} pts</span>
                </div>
                <div className="points-breakdown-item points-breakdown-item-bonus">
                  <span className="points-breakdown-label">Referrals Registered:</span>
                  <span className="points-breakdown-value">{points.breakdown.referrals_registered} × 100 = {points.breakdown.referrals_registered * 100} pts</span>
                </div>
                <div className="points-breakdown-item">
                  <span className="points-breakdown-label">Document Folders:</span>
                  <span className="points-breakdown-value">{points.breakdown.folders || 0} × 5 = {(points.breakdown.folders || 0) * 5} pts</span>
                </div>
                <div className="points-breakdown-item">
                  <span className="points-breakdown-label">Documents:</span>
                  <span className="points-breakdown-value">{points.breakdown.documents || 0} × 10 = {(points.breakdown.documents || 0) * 10} pts</span>
                </div>
                {points.breakdown.surplus_asset > 0 && (
                  <div className="points-breakdown-item">
                    <span className="points-breakdown-label">Surplus Asset Account:</span>
                    <span className="points-breakdown-value">{points.breakdown.surplus_asset} × 50 = {points.breakdown.surplus_asset * 50} pts</span>
                  </div>
                )}
                {points.breakdown.auto_disbursements > 0 && (
                  <div className="points-breakdown-item">
                    <span className="points-breakdown-label">Auto-Disbursements:</span>
                    <span className="points-breakdown-value">{points.breakdown.auto_disbursements} × 30 = {points.breakdown.auto_disbursements * 30} pts</span>
                  </div>
                )}
                <div className="points-breakdown-item">
                  <span className="points-breakdown-label">MFA Enabled:</span>
                  <span className="points-breakdown-value">{points.breakdown.mfa_enabled || 0} × 100 = {(points.breakdown.mfa_enabled || 0) * 100} pts</span>
                </div>
                {points.breakdown.plaid_connections > 0 && (
                  <div className="points-breakdown-item">
                    <span className="points-breakdown-label">Connected Bank Accounts:</span>
                    <span className="points-breakdown-value">{points.breakdown.plaid_connections} × 25 = {points.breakdown.plaid_connections * 25} pts</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PointsModal;


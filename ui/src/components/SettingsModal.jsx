import React, { useState, useEffect } from 'react';
import SettingsService from '../services/settings.service';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [inflationPercent, setInflationPercent] = useState(2.0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await SettingsService.getSettings();
      setInflationPercent(res.data.default_inflation_percent);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const handleSave = async () => {
    try {
      await SettingsService.updateSettings({
        default_inflation_percent: parseFloat(inflationPercent),
      });
      setMessage('Settings saved successfully!');
      setTimeout(() => {
        setMessage('');
        onClose();
      }, 1500);
    } catch (e) {
      console.error('Failed to save settings', e);
      setMessage('Error saving settings');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        
        {message && <div className="message">{message}</div>}

        <div className="settings-form">
          <label htmlFor="default-inflation">
            Default Inflation Rate (%)
          </label>
          <input
            id="default-inflation"
            type="number"
            step="0.1"
            value={inflationPercent}
            onChange={(e) => setInflationPercent(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import SettingsService from '../services/settings.service';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [inflation, setInflation] = useState(2.0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await SettingsService.getSettings();
      setInflation(res.data.default_inflation_percent);
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await SettingsService.updateSettings({ default_inflation_percent: inflation });
      setMessage("Settings saved!");
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      setMessage("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="settings-form">
          <label>Default Inflation (%)</label>
          <input
            type="number"
            step="0.1"
            value={inflation}
            onChange={(e) => setInflation(parseFloat(e.target.value))}
          />
        </div>
        {message && <p className="message">{message}</p>}
        <div className="modal-actions">
          <button onClick={handleSave} disabled={loading}>Save</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
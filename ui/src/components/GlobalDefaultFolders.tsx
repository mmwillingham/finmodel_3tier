import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import AuthService from '../services/auth.service';
import globalSettingsService from '../services/globalSettings.service';
import { projectionActionButtonSx } from '../utils/projectionUiStyles';
import { DEFAULT_DOCUMENT_FOLDER_STRUCTURE } from '../utils/documentFolderStructure';

const GlobalDefaultFolders = ({ onGlobalSettingsSaved }: any) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [structureJson, setStructureJson] = useState('');
  const [structure, setStructure] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = useMemo(() => AuthService.getToken(), [currentUser]);

  const refreshStructure = useCallback(async () => {
    if (!token || !currentUser?.is_admin) {
      setError('Access Denied: Only administrators may view this page.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await globalSettingsService.getGlobalSettings(token);
      const defaults = data.default_document_folders || DEFAULT_DOCUMENT_FOLDER_STRUCTURE;
      setStructure(defaults);
      setStructureJson(JSON.stringify(defaults, null, 2));
      setMessage('');
    } catch (err: any) {
      setError('Failed to load default folders.');
    } finally {
      setLoading(false);
    }
  }, [token, currentUser]);

  useEffect(() => {
    refreshStructure();
  }, [refreshStructure]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const parsed = JSON.parse(structureJson);
      await globalSettingsService.updateGlobalSettings({ default_document_folders: parsed }, token || '');
      setStructure(parsed);
      setStructureJson(JSON.stringify(parsed, null, 2));
      setMessage('Default folders saved successfully.');
      if (onGlobalSettingsSaved) {
        onGlobalSettingsSaved();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save default folders.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const serialized = JSON.stringify(DEFAULT_DOCUMENT_FOLDER_STRUCTURE, null, 2);
    setStructureJson(serialized);
    setMessage('Reset to recommended structure. Save to apply.');
  };

  const renderTree = (items: any, path = '') => {
    if (!items?.length) {
      return null;
    }
    return (
      <ul className="default-folder-tree">
        {items.map((item: any, index: any) => {
          const key = `${path}-${index}-${item.name}`;
          return (
            <li key={key}>
              <strong>{item.name}</strong>
              {item.children && renderTree(item.children, key)}
            </li>
          );
        })}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="loading-message">
        <CircularProgress size={20} />
        <span style={{ marginLeft: 8 }}>Loading default folders…</span>
      </div>
    );
  }

  return (
    <div className="global-default-folders">
      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <div className="setting-group">
        <label style={{ fontWeight: 700, fontSize: '1.1em' }}>Current default structure</label>
        <div className="default-folder-tree-wrapper">
          {renderTree(structure)}
        </div>
      </div>

      <div className="setting-group">
        <label style={{ fontWeight: 700, fontSize: '1.1em' }}>
          Edit default structure (JSON)
        </label>
        <textarea
          className="form-input"
          rows={18}
          value={structureJson}
          onChange={(event: any) => setStructureJson(event.target.value)}
        />
        <div className="section-note">
          You can edit the JSON tree directly. Each node requires a <code>name</code> and may include a <code>children</code> array.
        </div>
      </div>

      <div className="settings-page-actions" style={{ gap: 10 }}>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={projectionActionButtonSx}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Default Folders'}
        </Button>
        <Button onClick={handleReset} variant="outlined" sx={projectionActionButtonSx}>
          Reset to Recommended Structure
        </Button>
      </div>
    </div>
  );
};

export default GlobalDefaultFolders;

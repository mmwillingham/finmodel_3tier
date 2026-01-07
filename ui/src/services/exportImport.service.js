import axios from 'axios';
import authHeader from './auth-header';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ExportImportService {
  async exportData(includeOptions = {}) {
    const params = new URLSearchParams();
    Object.keys(includeOptions).forEach(key => {
      if (includeOptions[key] !== undefined) {
        params.append(key, includeOptions[key]);
      }
    });
    
    const response = await axios.get(`${API_URL}/export-import/export?${params.toString()}`, {
      headers: authHeader()
    });
    
    // Create a blob and download
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_data_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return { success: true };
  }

  async exportDataAsJson(includeOptions = {}) {
    const params = new URLSearchParams();
    Object.keys(includeOptions).forEach(key => {
      if (includeOptions[key] !== undefined) {
        params.append(key, includeOptions[key]);
      }
    });
    
    const response = await axios.get(`${API_URL}/export-import/export?${params.toString()}`, {
      headers: authHeader()
    });
    return response.data;
  }

  async importData(importData) {
    const response = await axios.post(`${API_URL}/export-import/import`, importData, {
      headers: authHeader()
    });
    return response.data;
  }
}

export default new ExportImportService();


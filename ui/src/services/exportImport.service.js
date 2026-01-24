import api from './api.service';

const ExportImportService = {
  async exportData(includeOptions = {}, format = 'json', filename = null) {
    try {
      const params = new URLSearchParams();
      Object.keys(includeOptions).forEach(key => {
        if (includeOptions[key] !== undefined) {
          params.append(key, includeOptions[key]);
        }
      });
      params.append('format', format);
      
      const response = await api.get(`/export-import/export?${params.toString()}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      // Determine default filename if not provided
      if (!filename) {
        const dateStr = new Date().toISOString().split('T')[0];
        filename = `financial_data_export_${dateStr}.${format === 'csv' ? 'csv' : 'json'}`;
      }
      
      // Create a blob and download
      let blob;
      if (format === 'csv') {
        blob = response.data;
      } else {
        blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  async exportDataAsJson(includeOptions = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(includeOptions).forEach(key => {
        if (includeOptions[key] !== undefined) {
          params.append(key, includeOptions[key]);
        }
      });
      
      const response = await api.get(`/export-import/export?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async importData(importData) {
    try {
      const response = await api.post('/export-import/import', importData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default ExportImportService;


import api from './api.service';

const ExportImportService = {
  async exportData(includeOptions = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(includeOptions).forEach(key => {
        if (includeOptions[key] !== undefined) {
          params.append(key, includeOptions[key]);
        }
      });
      
      const response = await api.get(`/export-import/export?${params.toString()}`);
      
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
    } catch (error) {
      console.error('Error exporting data:', error);
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
      console.error('Error exporting data as JSON:', error);
      throw error;
    }
  },

  async importData(importData) {
    try {
      const response = await api.post('/export-import/import', importData);
      return response.data;
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }
};

export default ExportImportService;


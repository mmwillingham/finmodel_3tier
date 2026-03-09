import api from './api.service';

type IncludeOptions = Record<string, string | number | boolean | undefined>;

const ExportImportService = {
  async exportData(includeOptions: IncludeOptions = {}, format: 'csv' | 'json' = 'json', filename: string | null = null) {
    try {
      const params = new URLSearchParams();
      Object.keys(includeOptions).forEach((key: any) => {
        const value = includeOptions[key];
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
      params.append('format', format);

      const response = await api.get(`/export-import/export?${params.toString()}`, {
        responseType: format === 'csv' ? ('blob' as const) : ('json' as const),
      });

      if (!filename) {
        const dateStr = new Date().toISOString().split('T')[0];
        filename = `financial_data_export_${dateStr}.${format === 'csv' ? 'csv' : 'json'}`;
      }

      let blob: Blob;
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
    } catch (error: any) {
      throw error;
    }
  },

  async exportDataAsJson(includeOptions: IncludeOptions = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(includeOptions).forEach((key: any) => {
        const value = includeOptions[key];
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });

      const response = await api.get(`/export-import/export?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async importData(importData: any) {
    try {
      const response = await api.post('/export-import/import', importData);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default ExportImportService;


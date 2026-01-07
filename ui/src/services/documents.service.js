import api from './api.service';

const DocumentsService = {
  // --- FOLDER OPERATIONS ---
  
  /**
   * Create a new folder
   */
  async createFolder(name, parentFolderId = null) {
    try {
      const response = await api.post('/documents/folders', {
        name,
        parent_folder_id: parentFolderId
      });
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  },

  /**
   * List folders (optionally filtered by parent folder)
   */
  async listFolders(parentFolderId = null) {
    try {
      const params = parentFolderId !== null ? { parent_folder_id: parentFolderId } : {};
      const response = await api.get('/documents/folders', { params });
      return response.data;
    } catch (error) {
      console.error('Error listing folders:', error);
      throw error;
    }
  },

  /**
   * Get a specific folder
   */
  async getFolder(folderId) {
    try {
      const response = await api.get(`/documents/folders/${folderId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting folder:', error);
      throw error;
    }
  },

  /**
   * Update a folder
   */
  async updateFolder(folderId, updates) {
    try {
      const response = await api.put(`/documents/folders/${folderId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  },

  /**
   * Delete a folder
   */
  async deleteFolder(folderId) {
    try {
      await api.delete(`/documents/folders/${folderId}`);
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  },

  // --- DOCUMENT OPERATIONS ---

  /**
   * Upload a document
   */
  async uploadDocument(file, name = null, description = null, folderId = null) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (name) formData.append('name', name);
      if (description) formData.append('description', description);
      if (folderId) formData.append('folder_id', folderId);

      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  /**
   * List documents (optionally filtered by folder)
   */
  async listDocuments(folderId = null) {
    try {
      const params = folderId !== null ? { folder_id: folderId } : {};
      const response = await api.get('/documents/', { params });
      return response.data;
    } catch (error) {
      console.error('Error listing documents:', error);
      throw error;
    }
  },

  /**
   * Get a specific document
   */
  async getDocument(documentId) {
    try {
      const response = await api.get(`/documents/${documentId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  },

  /**
   * Download a document
   */
  async downloadDocument(documentId, filename) {
    try {
      const response = await api.get(`/documents/${documentId}/download`, {
        responseType: 'blob'
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  },

  /**
   * Get a signed URL for a document
   */
  async getDocumentUrl(documentId, expirationMinutes = 60) {
    try {
      const response = await api.get(`/documents/${documentId}/url`, {
        params: { expiration_minutes: expirationMinutes }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting document URL:', error);
      throw error;
    }
  },

  /**
   * Update a document's metadata
   */
  async updateDocument(documentId, updates) {
    try {
      const response = await api.put(`/documents/${documentId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  },

  /**
   * Delete a document
   */
  async deleteDocument(documentId) {
    try {
      await api.delete(`/documents/${documentId}`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
};

export default DocumentsService;


import api from './api.service';

type DocumentFolderPayload = {
  name: string;
  parent_folder_id?: string | null;
};

type DocumentFolderResponse = any;
type DocumentResponse = any;

const DocumentsService = {
  async createFolder(name: string, parentFolderId: string | null = null) {
    try {
      const response = await api.post<DocumentFolderResponse>('/documents/folders', {
        name,
        parent_folder_id: parentFolderId,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async listFolders(parentFolderId: string | null = null, viewingUserId: number | null = null) {
    try {
      const params: Record<string, string | number> = {};
      if (parentFolderId !== null) {
        params.parent_folder_id = parentFolderId;
      }
      if (viewingUserId !== null) {
        params.viewing_user_id = viewingUserId;
      }
      const response = await api.get<DocumentFolderResponse[]>('/documents/folders', { params });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async addDefaultFolders() {
    try {
      const response = await api.post('/documents/default-folders');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getFolder(folderId: string) {
    try {
      const response = await api.get<DocumentFolderResponse>(`/documents/folders/${folderId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateFolder(folderId: string, updates: Partial<DocumentFolderPayload>) {
    try {
      const response = await api.put<DocumentFolderResponse>(`/documents/folders/${folderId}`, updates);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteFolder(folderId: string) {
    try {
      await api.delete(`/documents/folders/${folderId}`);
    } catch (error: any) {
      throw error;
    }
  },

  async uploadDocument(file: File, name: string | null = null, description: string | null = null, folderId: string | null = null) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (name) formData.append('name', name);
      if (description) formData.append('description', description);
      if (folderId) formData.append('folder_id', folderId);

      const response = await api.post<DocumentResponse>('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async listDocuments(folderId: string | null = null, viewingUserId: number | null = null) {
    try {
      const params: Record<string, string | number> = {};
      if (folderId !== null) {
        params.folder_id = folderId;
      }
      if (viewingUserId !== null) {
        params.viewing_user_id = viewingUserId;
      }
      const response = await api.get<DocumentResponse[]>('/documents/', { params });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getDocument(documentId: string) {
    try {
      const response = await api.get<DocumentResponse>(`/documents/${documentId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async downloadDocument(documentId: string, filename: string) {
    try {
      const response = await api.get<Blob>(`/documents/${documentId}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      throw error;
    }
  },

  async getDocumentUrl(documentId: string, expirationMinutes = 60) {
    try {
      const response = await api.get<{ url: string }>(`/documents/${documentId}/url`, {
        params: { expiration_minutes: expirationMinutes },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateDocument(documentId: string, updates: any) {
    try {
      const response = await api.put<DocumentResponse>(`/documents/${documentId}`, updates);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteDocument(documentId: string) {
    try {
      await api.delete(`/documents/${documentId}`);
    } catch (error: any) {
      throw error;
    }
  },
};

export default DocumentsService;


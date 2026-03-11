import api from './api.service';

export type DocumentFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'boolean'
  | 'email'
  | 'phone'
  | 'url'
  | 'textarea';

export interface DocumentFieldConfig {
  id: string;
  label: string;
  field_type: DocumentFieldType;
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
  is_sensitive?: boolean;
  hidden?: boolean;
}

export interface DocumentTypeDefinition {
  id: number;
  owner_id: number | null;
  category: string;
  doc_type: string;
  description?: string | null;
  fields_config: DocumentFieldConfig[];
  is_active: boolean;
  is_system_default: boolean;
  template_key?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DocumentEntry {
  id: number;
  owner_id: number;
  owner_email?: string | null;
  definition_id?: number | null;
  category: string;
  doc_type: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  metadata_json: Record<string, any>;
  folder_label?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  storage_path?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DefinitionPayload {
  category: string;
  doc_type: string;
  description?: string | null;
  fields_config: DocumentFieldConfig[];
  is_active?: boolean;
}

export interface EntryUpdatePayload {
  definition_id?: number | null;
  category?: string;
  doc_type?: string;
  title?: string;
  description?: string | null;
  notes?: string | null;
  metadata_json?: Record<string, any>;
  folder_label?: string | null;
}

const buildViewingParams = (viewingUserId: number | null = null) => {
  const params: Record<string, number> = {};
  if (viewingUserId !== null) {
    params.viewing_user_id = viewingUserId;
  }
  return params;
};

const DocumentsService = {
  async listDefinitions(viewingUserId: number | null = null) {
    const response = await api.get<DocumentTypeDefinition[]>('/documents/definitions', {
      params: buildViewingParams(viewingUserId),
    });
    return response.data;
  },

  async createDefinition(payload: DefinitionPayload, viewingUserId: number | null = null) {
    const response = await api.post<DocumentTypeDefinition>('/documents/definitions', payload, {
      params: buildViewingParams(viewingUserId),
    });
    return response.data;
  },

  async updateDefinition(definitionId: number, payload: Partial<DefinitionPayload>) {
    const response = await api.put<DocumentTypeDefinition>(`/documents/definitions/${definitionId}`, payload);
    return response.data;
  },

  async deleteDefinition(definitionId: number) {
    await api.delete(`/documents/definitions/${definitionId}`);
  },

  async loadRecommendedDefaults(viewingUserId: number | null = null) {
    const response = await api.post<{ created: number; message: string }>(
      '/documents/definitions/load-recommended-defaults',
      null,
      {
        params: buildViewingParams(viewingUserId),
      },
    );
    return response.data;
  },

  async listDefaultDefinitions() {
    const response = await api.get<DocumentTypeDefinition[]>('/documents/default-definitions');
    return response.data;
  },

  async createDefaultDefinition(payload: DefinitionPayload) {
    const response = await api.post<DocumentTypeDefinition>('/documents/default-definitions', payload);
    return response.data;
  },

  async updateDefaultDefinition(definitionId: number, payload: Partial<DefinitionPayload>) {
    const response = await api.put<DocumentTypeDefinition>(`/documents/default-definitions/${definitionId}`, payload);
    return response.data;
  },

  async deleteDefaultDefinition(definitionId: number) {
    await api.delete(`/documents/default-definitions/${definitionId}`);
  },

  async listEntries(options?: {
    viewingUserId?: number | null;
    search?: string;
    category?: string;
    docType?: string;
  }) {
    const params: Record<string, string | number> = {};
    if (options?.viewingUserId != null) {
      params.viewing_user_id = options.viewingUserId;
    }
    if (options?.search) {
      params.search = options.search;
    }
    if (options?.category) {
      params.category = options.category;
    }
    if (options?.docType) {
      params.doc_type = options.docType;
    }
    const response = await api.get<DocumentEntry[]>('/documents/entries', { params });
    return response.data;
  },

  async createEntry(payload: {
    title: string;
    category: string;
    docType: string;
    definitionId?: number | null;
    description?: string | null;
    notes?: string | null;
    metadataJson?: Record<string, any>;
    folderLabel?: string | null;
    viewingUserId?: number | null;
    file?: File | null;
  }) {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('category', payload.category);
    formData.append('doc_type', payload.docType);
    if (payload.definitionId != null) {
      formData.append('definition_id', String(payload.definitionId));
    }
    if (payload.description) {
      formData.append('description', payload.description);
    }
    if (payload.notes) {
      formData.append('notes', payload.notes);
    }
    if (payload.folderLabel) {
      formData.append('folder_label', payload.folderLabel);
    }
    if (payload.metadataJson) {
      formData.append('metadata_json', JSON.stringify(payload.metadataJson));
    }
    if (payload.viewingUserId != null) {
      formData.append('viewing_user_id', String(payload.viewingUserId));
    }
    if (payload.file) {
      formData.append('file', payload.file);
    }

    const response = await api.post<DocumentEntry>('/documents/entries', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async updateEntry(entryId: number, payload: EntryUpdatePayload) {
    const response = await api.put<DocumentEntry>(`/documents/entries/${entryId}`, payload);
    return response.data;
  },

  async deleteEntry(entryId: number) {
    await api.delete(`/documents/entries/${entryId}`);
  },

  async downloadEntry(entryId: number, filename: string) {
    const response = await api.get<Blob>(`/documents/entries/${entryId}/download`, {
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
  },
};

export default DocumentsService;


import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AccountSwitcher from '../components/AccountSwitcher';
import SettingsService from '../services/settings.service';
import DocumentsService, {
  type DocumentEntry,
  type DocumentFieldConfig,
  type DocumentTypeDefinition,
  type DefinitionPayload,
} from '../services/documents.service';
import './DocumentsPage.css';
import '../components/SidebarLayout.css';
import { DEFAULT_DOCUMENT_FOLDER_STRUCTURE } from '../utils/documentFolderStructure';

type VaultTab = 'entries' | 'types' | 'defaults';

type EntryDraft = {
  id?: number;
  title: string;
  description: string;
  notes: string;
  definitionId: number | null;
  category: string;
  docType: string;
  folderLabel: string;
  metadata: Record<string, any>;
  file: File | null;
};

type DefinitionDraft = {
  id?: number;
  category: string;
  doc_type: string;
  description: string;
  is_active: boolean;
  fields_config: DocumentFieldConfig[];
};

type FolderStructureItem = {
  name: string;
  children?: FolderStructureItem[];
};

const EMPTY_FIELD: DocumentFieldConfig = {
  id: '',
  label: '',
  field_type: 'text',
  required: false,
  placeholder: '',
  options: [],
  is_sensitive: false,
  hidden: false,
};

const EMPTY_DEFINITION: DefinitionDraft = {
  category: '',
  doc_type: '',
  description: '',
  is_active: true,
  fields_config: [{ ...EMPTY_FIELD }],
};

const EMPTY_ENTRY: EntryDraft = {
  title: '',
  description: '',
  notes: '',
  definitionId: null,
  category: '',
  docType: '',
  folderLabel: '',
  metadata: {},
  file: null,
};

const FIELD_TYPES: Array<DocumentFieldConfig['field_type']> = [
  'text',
  'number',
  'date',
  'select',
  'multi-select',
  'boolean',
  'email',
  'phone',
  'url',
  'textarea',
];

const DocumentVaultPage = ({
  hideSidebar = false,
  initialTab = 'entries',
  adminPortal = false,
}: {
  hideSidebar?: boolean;
  initialTab?: VaultTab;
  adminPortal?: boolean;
}) => {
  const { currentUser, viewingUserId } = useAuth();
  const [entries, setEntries] = useState<DocumentEntry[]>([]);
  const [definitions, setDefinitions] = useState<DocumentTypeDefinition[]>([]);
  const [defaultDefinitions, setDefaultDefinitions] = useState<DocumentTypeDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<VaultTab>(initialTab);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDefinitionModal, setShowDefinitionModal] = useState(false);
  const [showDefaultDefinitionModal, setShowDefaultDefinitionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDefaultsTooltip, setShowDefaultsTooltip] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(EMPTY_ENTRY);
  const [definitionDraft, setDefinitionDraft] = useState<DefinitionDraft>(EMPTY_DEFINITION);
  const [defaultDefinitionDraft, setDefaultDefinitionDraft] = useState<DefinitionDraft>(EMPTY_DEFINITION);
  const [folderOptions, setFolderOptions] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!currentUser?.id) {
      setCustomCategories([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`vault_custom_categories_${currentUser.id}`);
      setCustomCategories(saved ? JSON.parse(saved) : []);
    } catch {
      setCustomCategories([]);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }
    localStorage.setItem(`vault_custom_categories_${currentUser.id}`, JSON.stringify(customCategories));
  }, [customCategories, currentUser?.id]);

  const categoryOptions = useMemo(() => {
    const values = new Set<string>();
    customCategories.forEach((category) => values.add(category));
    definitions.forEach((definition) => values.add(definition.category));
    entries.forEach((entry) => values.add(entry.category));
    return Array.from(values).sort();
  }, [customCategories, definitions, entries]);

  const docTypeOptions = useMemo(() => {
    const values = new Set<string>();
    definitions
      .filter((definition) => !categoryFilter || definition.category === categoryFilter)
      .forEach((definition) => values.add(definition.doc_type));
    entries
      .filter((entry) => !categoryFilter || entry.category === categoryFilter)
      .forEach((entry) => values.add(entry.doc_type));
    return Array.from(values).sort();
  }, [categoryFilter, definitions, entries]);

  const entryCount = entries.length;
  const entryFileCount = entries.filter((entry) => Boolean(entry.file_name)).length;
  const activeDefinitionCount = definitions.filter((definition) => definition.is_active).length;
  const defaultDefinitionCount = defaultDefinitions.filter((definition) => definition.is_active).length;

  const selectedDefinition = useMemo(
    () => definitions.find((definition) => definition.id === entryDraft.definitionId) || null,
    [definitions, entryDraft.definitionId],
  );

  const locationOptions = useMemo(() => {
    const options = new Set(folderOptions);
    if (entryDraft.folderLabel.trim()) {
      options.add(entryDraft.folderLabel.trim());
    }
    return Array.from(options).sort();
  }, [entryDraft.folderLabel, folderOptions]);

  const flattenFolderPaths = (items: FolderStructureItem[], prefix = ''): string[] => {
    return items.flatMap((item) => {
      const path = prefix ? `${prefix} / ${item.name}` : item.name;
      const nested = item.children?.length ? flattenFolderPaths(item.children, path) : [];
      return [path, ...nested];
    });
  };

  const loadEntries = async () => {
    const data = await DocumentsService.listEntries({
      viewingUserId,
      search: search.trim() || undefined,
      category: categoryFilter || undefined,
      docType: docTypeFilter || undefined,
    });
    setEntries(data);
  };

  const loadDefinitions = async () => {
    const data = await DocumentsService.listDefinitions(viewingUserId);
    setDefinitions(data);
  };

  const loadDefaultDefinitions = async () => {
    if (!currentUser?.is_admin) {
      setDefaultDefinitions([]);
      return;
    }
    const data = await DocumentsService.listDefaultDefinitions();
    setDefaultDefinitions(data);
  };

  const loadFolderOptions = async () => {
    try {
      const response = await SettingsService.getDefaultCategories();
      const folders = response.data?.default_document_folders || DEFAULT_DOCUMENT_FOLDER_STRUCTURE;
      setFolderOptions(flattenFolderPaths(folders));
    } catch {
      setFolderOptions(flattenFolderPaths(DEFAULT_DOCUMENT_FOLDER_STRUCTURE));
    }
  };

  const loadPageData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        loadDefinitions(),
        loadEntries(),
        loadFolderOptions(),
        currentUser?.is_admin ? loadDefaultDefinitions() : Promise.resolve(),
      ]);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load the document vault.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, [viewingUserId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEntries().catch((err: any) => {
        setError(err.response?.data?.detail || err.message || 'Failed to search the document vault.');
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, categoryFilter, docTypeFilter]);

  useEffect(() => {
    if (!selectedDefinition) {
      return;
    }
    const suggestedPath =
      selectedDefinition.doc_type === selectedDefinition.category
        ? selectedDefinition.category
        : `${selectedDefinition.category} / ${selectedDefinition.doc_type}`;
    setEntryDraft((current) => {
      const nextMetadata = { ...current.metadata };
      selectedDefinition.fields_config.forEach((field) => {
        if (nextMetadata[field.id] == null) {
          nextMetadata[field.id] = field.field_type === 'multi-select' ? [] : field.field_type === 'boolean' ? false : '';
        }
      });
      return {
        ...current,
        category: selectedDefinition.category,
        docType: selectedDefinition.doc_type,
        folderLabel: current.folderLabel || (locationOptions.includes(suggestedPath) ? suggestedPath : current.folderLabel),
        metadata: nextMetadata,
      };
    });
  }, [locationOptions, selectedDefinition]);

  const resetEntryModal = () => {
    setEntryDraft(EMPTY_ENTRY);
    setShowEntryModal(false);
  };

  const resetDefinitionModal = () => {
    setDefinitionDraft(EMPTY_DEFINITION);
    setShowDefinitionModal(false);
  };

  const resetDefaultDefinitionModal = () => {
    setDefaultDefinitionDraft(EMPTY_DEFINITION);
    setShowDefaultDefinitionModal(false);
  };

  const openCreateEntry = () => {
    setMessage('');
    setEntryDraft(EMPTY_ENTRY);
    setShowEntryModal(true);
  };

  const openEditEntry = (entry: DocumentEntry) => {
    setMessage('');
    setEntryDraft({
      id: entry.id,
      title: entry.title,
      description: entry.description || '',
      notes: entry.notes || '',
      definitionId: entry.definition_id || null,
      category: entry.category,
      docType: entry.doc_type,
      folderLabel: entry.folder_label || '',
      metadata: { ...(entry.metadata_json || {}) },
      file: null,
    });
    setShowEntryModal(true);
  };

  const openCreateDefinition = () => {
    setDefinitionDraft(EMPTY_DEFINITION);
    setShowDefinitionModal(true);
  };

  const openCreateDefinitionForCategory = (category: string) => {
    setDefinitionDraft({
      ...EMPTY_DEFINITION,
      category,
    });
    setShowDefinitionModal(true);
  };

  const openEditDefinition = (definition: DocumentTypeDefinition) => {
    setDefinitionDraft({
      id: definition.id,
      category: definition.category,
      doc_type: definition.doc_type,
      description: definition.description || '',
      is_active: definition.is_active,
      fields_config:
        definition.fields_config.length > 0
          ? definition.fields_config.map((field) => ({ ...field, options: field.options || [] }))
          : [{ ...EMPTY_FIELD }],
    });
    setShowDefinitionModal(true);
  };

  const openCreateDefaultDefinition = () => {
    setDefaultDefinitionDraft(EMPTY_DEFINITION);
    setShowDefaultDefinitionModal(true);
  };

  const handleSaveCategory = () => {
    const category = newCategoryName.trim();
    if (!category) {
      setError('Category name is required.');
      return;
    }
    setCustomCategories((current) => (current.includes(category) ? current : [...current, category].sort()));
    setShowCategoryModal(false);
    setNewCategoryName('');
    setMessage(`Category "${category}" added. Create a document type to use it.`);
    openCreateDefinitionForCategory(category);
  };

  const openEditDefaultDefinition = (definition: DocumentTypeDefinition) => {
    setDefaultDefinitionDraft({
      id: definition.id,
      category: definition.category,
      doc_type: definition.doc_type,
      description: definition.description || '',
      is_active: definition.is_active,
      fields_config:
        definition.fields_config.length > 0
          ? definition.fields_config.map((field) => ({ ...field, options: field.options || [] }))
          : [{ ...EMPTY_FIELD }],
    });
    setShowDefaultDefinitionModal(true);
  };

  const handleLoadRecommendedDefaults = async () => {
    setError('');
    try {
      const response = await DocumentsService.loadRecommendedDefaults(viewingUserId);
      setMessage(`${response.message} It will not overwrite existing document types.`);
      await loadDefinitions();
      setActiveTab('types');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load recommended defaults.');
    }
  };

  const buildDefinitionPayload = (draft: DefinitionDraft): DefinitionPayload => ({
    category: draft.category.trim(),
    doc_type: draft.doc_type.trim(),
    description: draft.description.trim() || null,
    is_active: draft.is_active,
    fields_config: draft.fields_config.map((field) => ({
      ...field,
      id: field.id.trim(),
      label: field.label.trim(),
      placeholder: field.placeholder?.trim() || '',
      options: field.options || [],
    })),
  });

  const handleSaveDefinition = async (isDefault: boolean) => {
    const draft = isDefault ? defaultDefinitionDraft : definitionDraft;
    const closeModal = isDefault ? resetDefaultDefinitionModal : resetDefinitionModal;
    if (!draft.category.trim() || !draft.doc_type.trim()) {
      setError('Category and document type are required.');
      return;
    }
    if (draft.fields_config.some((field) => !field.id.trim() || !field.label.trim())) {
      setError('Every field needs both an id and label.');
      return;
    }

    setError('');
    try {
      const payload = buildDefinitionPayload(draft);
      if (isDefault) {
        if (draft.id) {
          await DocumentsService.updateDefaultDefinition(draft.id, payload);
        } else {
          await DocumentsService.createDefaultDefinition(payload);
        }
        await loadDefaultDefinitions();
      } else {
        if (draft.id) {
          await DocumentsService.updateDefinition(draft.id, payload);
        } else {
          await DocumentsService.createDefinition(payload, viewingUserId);
        }
        await loadDefinitions();
      }
      setMessage(`${isDefault ? 'Recommended default' : 'Document type'} saved.`);
      closeModal();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save definition.');
    }
  };

  const handleDeleteDefinition = async (definition: DocumentTypeDefinition, isDefault: boolean) => {
    if (!window.confirm(`Delete "${definition.doc_type}"?`)) {
      return;
    }
    setError('');
    try {
      if (isDefault) {
        await DocumentsService.deleteDefaultDefinition(definition.id);
        await loadDefaultDefinitions();
      } else {
        await DocumentsService.deleteDefinition(definition.id);
        await loadDefinitions();
      }
      setMessage(`${definition.doc_type} deleted.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete definition.');
    }
  };

  const handleSaveEntry = async () => {
    if (!entryDraft.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!entryDraft.category.trim() || !entryDraft.docType.trim()) {
      setError('Category and type are required.');
      return;
    }
    if (
      selectedDefinition &&
      selectedDefinition.fields_config.some((field) => {
        if (!field.required || field.hidden) {
          return false;
        }
        const value = entryDraft.metadata[field.id];
        return value == null || value === '' || (Array.isArray(value) && value.length === 0);
      })
    ) {
      setError('Please complete all required metadata fields.');
      return;
    }

    setError('');
    try {
      if (entryDraft.id) {
        await DocumentsService.updateEntry(entryDraft.id, {
          definition_id: entryDraft.definitionId,
          category: entryDraft.category.trim(),
          doc_type: entryDraft.docType.trim(),
          title: entryDraft.title.trim(),
          description: entryDraft.description.trim() || null,
          notes: entryDraft.notes.trim() || null,
          metadata_json: entryDraft.metadata,
          folder_label: entryDraft.folderLabel.trim() || null,
        });
      } else {
        await DocumentsService.createEntry({
          title: entryDraft.title.trim(),
          category: entryDraft.category.trim(),
          docType: entryDraft.docType.trim(),
          definitionId: entryDraft.definitionId,
          description: entryDraft.description.trim() || null,
          notes: entryDraft.notes.trim() || null,
          folderLabel: entryDraft.folderLabel.trim() || null,
          metadataJson: entryDraft.metadata,
          viewingUserId,
          file: entryDraft.file,
        });
      }
      await loadEntries();
      setMessage(`Vault entry ${entryDraft.id ? 'updated' : 'created'}.`);
      resetEntryModal();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save vault entry.');
    }
  };

  const handleDeleteEntry = async (entry: DocumentEntry) => {
    if (!window.confirm(`Delete "${entry.title}"?`)) {
      return;
    }
    setError('');
    try {
      await DocumentsService.deleteEntry(entry.id);
      await loadEntries();
      setMessage(`${entry.title} deleted.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete vault entry.');
    }
  };

  const handleDownloadEntry = async (entry: DocumentEntry) => {
    try {
      await DocumentsService.downloadEntry(entry.id, entry.file_name || entry.title);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to download file.');
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'No file';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  const summarizeMetadata = (metadata: Record<string, any>) => {
    const pairs = Object.entries(metadata || {}).filter(([, value]) => {
      if (value == null || value === '') {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return true;
    });
    return pairs.slice(0, 3).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  };

  const updateMetadataValue = (fieldId: string, value: any) => {
    setEntryDraft((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [fieldId]: value,
      },
    }));
  };

  const renderFieldInput = (field: DocumentFieldConfig) => {
    const value = entryDraft.metadata[field.id];

    if (field.hidden) {
      return null;
    }

    if (field.field_type === 'textarea') {
      return (
        <textarea
          className="form-input"
          name={`vault-${field.id}-${entryDraft.id ?? 'new'}`}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          spellCheck={false}
          rows={3}
          value={value ?? ''}
          onChange={(event) => updateMetadataValue(field.id, event.target.value)}
          placeholder={field.placeholder || ''}
        />
      );
    }

    if (field.field_type === 'select') {
      return (
        <select
          className="form-input"
          name={`vault-${field.id}-${entryDraft.id ?? 'new'}`}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          value={value ?? ''}
          onChange={(event) => updateMetadataValue(field.id, event.target.value)}
        >
          <option value="">Select...</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.field_type === 'multi-select') {
      return (
        <select
          className="form-input"
          name={`vault-${field.id}-${entryDraft.id ?? 'new'}`}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          multiple
          value={Array.isArray(value) ? value : []}
          onChange={(event) =>
            updateMetadataValue(
              field.id,
              Array.from(event.target.selectedOptions).map((option) => option.value),
            )
          }
        >
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.field_type === 'boolean') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateMetadataValue(field.id, event.target.checked)}
          />
          Yes
        </label>
      );
    }

    const inputType =
      field.field_type === 'phone'
        ? 'tel'
        : field.field_type === 'number'
          ? 'number'
          : field.field_type === 'date'
            ? 'date'
            : field.field_type === 'email'
              ? 'email'
              : field.field_type === 'url'
                ? 'url'
                : field.is_sensitive
                  ? 'password'
                  : 'text';

    return (
      <input
        type={inputType}
        className="form-input"
        name={`vault-${field.id}-${entryDraft.id ?? 'new'}`}
        autoComplete={field.is_sensitive ? 'new-password' : 'off'}
        data-lpignore="true"
        data-1p-ignore="true"
        spellCheck={false}
        value={value ?? ''}
        onChange={(event) => updateMetadataValue(field.id, event.target.value)}
        placeholder={field.placeholder || ''}
      />
    );
  };

  const renderDefinitionTable = (items: DocumentTypeDefinition[], isDefault: boolean) => (
    <table className="documents-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Type</th>
          <th>Status</th>
          <th>Fields</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((definition) => (
          <tr key={definition.id}>
            <td>{definition.category}</td>
            <td>
              <strong>{definition.doc_type}</strong>
              {definition.description && (
                <div className="vault-subtle-text" style={{ marginTop: '4px' }}>{definition.description}</div>
              )}
            </td>
            <td>
              <span className={`vault-badge ${definition.is_active ? 'vault-badge-active' : 'vault-badge-muted'}`}>
                {definition.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td>{definition.fields_config.length}</td>
            <td className="actions-cell">
              <button
                onClick={() => (isDefault ? openEditDefaultDefinition(definition) : openEditDefinition(definition))}
                className="btn-icon"
                title="Edit"
              >
                ✏️
              </button>
              <button onClick={() => void handleDeleteDefinition(definition, isDefault)} className="btn-icon" title="Delete">
                🗑️
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderDefinitionModal = (
    title: string,
    draft: DefinitionDraft,
    setDraft: React.Dispatch<React.SetStateAction<DefinitionDraft>>,
    onClose: () => void,
    onSave: () => void,
  ) => {
    const usingExistingCategory = Boolean(draft.category) && categoryOptions.includes(draft.category);
    const categorySelectValue = usingExistingCategory ? draft.category : '__new__';

    return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '860px' }}>
        <h2>{title}</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          <select
            className="form-input"
            value={categorySelectValue}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value === '__new__' ? '' : event.target.value,
              }))
            }
          >
            <option value="__new__">New category...</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {!usingExistingCategory && (
            <input
              className="form-input"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              value={draft.category}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
              placeholder="Category name"
            />
          )}
          <input
            className="form-input"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            value={draft.doc_type}
            onChange={(event) => setDraft((current) => ({ ...current, doc_type: event.target.value }))}
            placeholder="Document type"
          />
          <textarea
            className="form-input"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            rows={2}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Description"
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))}
            />
            Active
          </label>
        </div>

        <p className="vault-helper-text vault-helper-text-strong">
          Field edits update the schema used for future entries. Existing entries keep their stored data.
        </p>
        <h3 style={{ marginTop: '20px' }}>Fields</h3>
        <div style={{ display: 'grid', gap: '14px' }}>
          {draft.fields_config.map((field, index) => (
            <div
              key={`${field.id || 'new'}-${index}`}
              className="vault-field-card"
            >
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <input
                  className="form-input"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={field.id}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      fields_config: current.fields_config.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, id: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="Field id"
                />
                <input
                  className="form-input"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={field.label}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      fields_config: current.fields_config.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="Field label"
                />
                <select
                  className="form-input"
                  autoComplete="off"
                  value={field.field_type}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      fields_config: current.fields_config.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, field_type: event.target.value as DocumentFieldConfig['field_type'] } : item,
                      ),
                    }))
                  }
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  className="form-input"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={field.placeholder || ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      fields_config: current.fields_config.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, placeholder: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="Placeholder"
                />
              </div>
              {(field.field_type === 'select' || field.field_type === 'multi-select') && (
                <input
                  className="form-input"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  style={{ marginTop: '10px' }}
                  value={(field.options || []).join(', ')}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      fields_config: current.fields_config.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              options: event.target.value
                                .split(',')
                                .map((option) => option.trim())
                                .filter(Boolean),
                            }
                          : item,
                      ),
                    }))
                  }
                  placeholder="Options, comma separated"
                />
              )}
              <div style={{ display: 'flex', gap: '18px', marginTop: '12px', flexWrap: 'wrap' }}>
                {(['required', 'is_sensitive', 'hidden'] as const).map((flag) => (
                  <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(field[flag])}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fields_config: current.fields_config.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, [flag]: event.target.checked } : item,
                          ),
                        }))
                      }
                    />
                    {flag}
                  </label>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      fields_config:
                        current.fields_config.length > 1
                          ? current.fields_config.filter((_, itemIndex) => itemIndex !== index)
                          : [{ ...EMPTY_FIELD }],
                    }))
                  }
                >
                  Remove Field
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '14px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setDraft((current) => ({ ...current, fields_config: [...current.fields_config, { ...EMPTY_FIELD }] }))}
          >
            Add Field
          </button>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onSave} className="btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
    );
  };

  const content = (
    <div className="documents-page">
      <div className="documents-header">
        <div className="documents-header-top">
          <h1 className="documents-title">{adminPortal ? 'Document Vault Defaults' : 'Document Vault'}</h1>
          <AccountSwitcher compact={true} />
        </div>
        <div className="documents-actions">
          {!adminPortal && (
            <button className="btn-primary" onClick={openCreateEntry}>
              New Entry
            </button>
          )}
          {!adminPortal && (
            <button className="btn-primary" onClick={openCreateDefinition}>
              New Document Type
            </button>
          )}
          {!adminPortal && (
            <button className="btn-secondary" onClick={() => setShowCategoryModal(true)}>
              New Category
            </button>
          )}
          {!adminPortal && (
            <div className="default-folders-tooltip-container">
              <button className="btn-secondary" onClick={() => void handleLoadRecommendedDefaults()}>
                Load Default DocTypes
              </button>
              <button
                type="button"
                className="default-folders-tooltip-toggle"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDefaultsTooltip((current) => !current);
                }}
                aria-expanded={showDefaultsTooltip}
                aria-label="Show note about recommended defaults"
              >
                i
              </button>
              {showDefaultsTooltip && (
                <div className="default-folders-tooltip" role="tooltip">
                  Adds missing defaults only. It will not overwrite existing document types or data.
                </div>
              )}
            </div>
          )}
          {currentUser?.is_admin && !adminPortal && (
            <button className="btn-secondary" onClick={() => setActiveTab('defaults')}>
              Manage Recommended Defaults
            </button>
          )}
          {currentUser?.is_admin && adminPortal && (
            <button className="btn-primary" onClick={openCreateDefaultDefinition}>
              + New Recommended Default
            </button>
          )}
        </div>
        {!!message && <div className="vault-notice vault-notice-success">{message}</div>}
      </div>

      <div className="vault-summary-grid">
        <div className="vault-summary-card">
          <span className="vault-summary-label">Visible entries</span>
          <strong className="vault-summary-value">{entryCount}</strong>
          <span className="vault-summary-footnote">Filtered by your current search and sharing context</span>
        </div>
        <div className="vault-summary-card">
          <span className="vault-summary-label">Entries with files</span>
          <strong className="vault-summary-value">{entryFileCount}</strong>
          <span className="vault-summary-footnote">OCR and PDF extraction run when files are attached</span>
        </div>
        <div className="vault-summary-card">
          <span className="vault-summary-label">My active types</span>
          <strong className="vault-summary-value">{activeDefinitionCount}</strong>
          <span className="vault-summary-footnote">Schema-driven forms render from these definitions</span>
        </div>
        {currentUser?.is_admin && (
          <div className="vault-summary-card">
            <span className="vault-summary-label">Recommended defaults</span>
            <strong className="vault-summary-value">{defaultDefinitionCount}</strong>
            <span className="vault-summary-footnote">Active defaults are preloaded for new users</span>
          </div>
        )}
      </div>

      {!adminPortal && (
        <div className="vault-filter-grid">
          <input
            className="form-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, notes, metadata, or file text"
          />
          <select className="form-input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select className="form-input" value={docTypeFilter} onChange={(event) => setDocTypeFilter(event.target.value)}>
            <option value="">All types</option>
            {docTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="vault-tab-row">
        {!adminPortal && (
          <button className={activeTab === 'entries' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('entries')}>
            Vault Entries
          </button>
        )}
        {!adminPortal && (
          <button className={activeTab === 'types' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('types')}>
            My Document Types
          </button>
        )}
        {currentUser?.is_admin && (
          <button className={activeTab === 'defaults' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('defaults')}>
            Recommended Defaults
          </button>
        )}
      </div>

      {adminPortal && (
        <div className="vault-notice vault-notice-info">
          Admin portal: manage the recommended default document types that are preloaded for new users. Existing users can
          still add missing defaults later without overwriting existing data.
        </div>
      )}

      {loading && <div className="loading">Loading document vault...</div>}
      {!!error && <div className="error">{error}</div>}

      {!loading && !error && activeTab === 'entries' && (
        <div className="documents-content">
          <table className="documents-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Type</th>
                <th>Path</th>
                <th>File</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.title}</strong>
                    {entry.description && (
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>{entry.description}</div>
                    )}
                    {entry.notes && (
                      <div style={{ fontSize: '0.82rem', color: '#4b5563', marginTop: '4px' }}>{entry.notes}</div>
                    )}
                    {summarizeMetadata(entry.metadata_json).length > 0 && (
                      <div className="vault-chip-row">
                        {summarizeMetadata(entry.metadata_json).map((item) => (
                          <span key={item} className="vault-chip">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="vault-badge vault-badge-muted">{entry.category}</span>
                  </td>
                  <td>
                    <span className="vault-badge vault-badge-active">{entry.doc_type}</span>
                  </td>
                  <td>{entry.folder_label || '-'}</td>
                  <td>{entry.file_name ? `${entry.file_name} (${formatFileSize(entry.file_size)})` : 'No file'}</td>
                  <td>{formatDate(entry.updated_at || entry.created_at)}</td>
                  <td className="actions-cell">
                    {entry.file_name && (
                      <button onClick={() => void handleDownloadEntry(entry)} className="btn-icon" title="Download">
                        ⬇️
                      </button>
                    )}
                    <button onClick={() => openEditEntry(entry)} className="btn-icon" title="Edit">
                      ✏️
                    </button>
                    <button onClick={() => void handleDeleteEntry(entry)} className="btn-icon" title="Delete">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#666' }}>
                    No vault entries match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && activeTab === 'types' && (
        <div className="documents-content">
          {definitions.length > 0 ? (
            renderDefinitionTable(definitions, false)
          ) : (
            <div className="empty-state">
              <p>No document types yet.</p>
              <p>Create your first schema to unlock dynamic entry forms.</p>
            </div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'defaults' && currentUser?.is_admin && (
        <div className="documents-content">
          <div style={{ marginBottom: '16px', color: '#475569' }}>
            Active recommended defaults are prepopulated for new users. Existing users can load missing ones with
            `Load Recommended Defaults` and it will not overwrite existing data.
          </div>
          <div style={{ marginBottom: '14px' }}>
            <button className="btn-primary" onClick={openCreateDefaultDefinition}>
              + New Recommended Default
            </button>
          </div>
          {defaultDefinitions.length > 0 ? (
            renderDefinitionTable(defaultDefinitions, true)
          ) : (
            <div className="empty-state">
              <p>No recommended defaults yet.</p>
              <p>Create one here to automatically seed it for future users.</p>
            </div>
          )}
        </div>
      )}

      {showEntryModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '860px' }}>
            <h2>{entryDraft.id ? 'Edit Vault Entry' : 'New Vault Entry'}</h2>
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <select
                className="form-input"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={entryDraft.definitionId ?? ''}
                onChange={(event) =>
                  setEntryDraft((current) => ({
                    ...current,
                    definitionId: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              >
                <option value="">Custom / no saved type</option>
                {definitions
                  .filter((definition) => definition.is_active)
                  .map((definition) => (
                    <option key={definition.id} value={definition.id}>
                      {definition.category} / {definition.doc_type}
                    </option>
                  ))}
              </select>
              <input
                className="form-input"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={entryDraft.category}
                onChange={(event) => setEntryDraft((current) => ({ ...current, category: event.target.value }))}
                placeholder="Category"
                disabled={Boolean(selectedDefinition)}
              />
              <input
                className="form-input"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={entryDraft.docType}
                onChange={(event) => setEntryDraft((current) => ({ ...current, docType: event.target.value }))}
                placeholder="Document type"
                disabled={Boolean(selectedDefinition)}
              />
              <input
                className="form-input"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={entryDraft.title}
                onChange={(event) => setEntryDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Title"
              />
              <select
                className="form-input"
                value={entryDraft.folderLabel}
                onChange={(event) => setEntryDraft((current) => ({ ...current, folderLabel: event.target.value }))}
              >
                <option value="">Select folder location...</option>
                {locationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {selectedDefinition && (
              <div style={{ marginTop: '20px' }}>
                <h3>{selectedDefinition.doc_type} fields</h3>
                {selectedDefinition.description && (
                  <p className="vault-helper-text" style={{ marginBottom: '12px' }}>
                    {selectedDefinition.description}
                  </p>
                )}
                <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  {selectedDefinition.fields_config.map((field) => (
                    <div key={field.id}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </label>
                      {renderFieldInput(field)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              className="form-input"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              rows={2}
              value={entryDraft.description}
              onChange={(event) => setEntryDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Description"
              style={{ marginTop: '12px' }}
            />
            <textarea
              className="form-input"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              rows={3}
              value={entryDraft.notes}
              onChange={(event) => setEntryDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notes"
              style={{ marginTop: '12px' }}
            />
            {!entryDraft.id && (
              <>
                <input
                  type="file"
                  className="form-input"
                  onChange={(event) =>
                    setEntryDraft((current) => ({
                      ...current,
                      file: event.target.files && event.target.files.length > 0 ? event.target.files[0] : null,
                    }))
                  }
                />
                <div className="vault-helper-text">
                  Attach a PDF, image, or text-based document. PDFs are text-extracted first, then OCR is used for scanned pages.
                </div>
              </>
            )}

            <div className="modal-actions">
              <button onClick={resetEntryModal} className="btn-secondary">
                Cancel
              </button>
              <button onClick={() => void handleSaveEntry()} className="btn-primary">
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {showDefinitionModal &&
        renderDefinitionModal(
          definitionDraft.id ? 'Edit Document Type' : 'New Document Type',
          definitionDraft,
          setDefinitionDraft,
          resetDefinitionModal,
          () => void handleSaveDefinition(false),
        )}

      {showDefaultDefinitionModal &&
        renderDefinitionModal(
          defaultDefinitionDraft.id ? 'Edit Recommended Default' : 'New Recommended Default',
          defaultDefinitionDraft,
          setDefaultDefinitionDraft,
          resetDefaultDefinitionModal,
          () => void handleSaveDefinition(true),
        )}
      {showCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h2>New Category</h2>
            <input
              className="form-input"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Category name"
            />
            <p className="vault-helper-text">Create the category first, then add document types inside it.</p>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleSaveCategory} className="btn-primary">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return hideSidebar ? content : content;
};

export default DocumentVaultPage;

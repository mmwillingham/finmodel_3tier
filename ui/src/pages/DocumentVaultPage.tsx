import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
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

const FOLDER_LOCATION_HINTS: Record<string, string[]> = {
  'Financial::Life Insurance': ['Insurance Policies / Life'],
  'Financial::Asset Account': ['Financial Accounts'],
  'Health::Health Insurance': ['Insurance Policies / Health/Medicare', 'Healthcare & Medical / Insurance Cards'],
  'Digital Assets::Password Management': ['Digital Estate & Passwords / Account Logins'],
  'Legal::Will': ['Legal & Estate / Wills / Original Will', 'Legal & Estate / Wills'],
};

const NEW_CATEGORY_OPTION = '__new_category__';
const NEW_DOC_TYPE_OPTION = '__new_doc_type__';

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
  const location = useLocation();
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
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [showManageTypesModal, setShowManageTypesModal] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showDefaultsTooltip, setShowDefaultsTooltip] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryRenameDrafts, setCategoryRenameDrafts] = useState<Record<string, string>>({});
  const [selectedBrowseCategory, setSelectedBrowseCategory] = useState('');
  const [selectedBrowseDocType, setSelectedBrowseDocType] = useState('');
  const [visibleSensitiveFields, setVisibleSensitiveFields] = useState<Record<string, boolean>>({});
  const [visibleSensitiveModalFields, setVisibleSensitiveModalFields] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmDialogLoading, setConfirmDialogLoading] = useState(false);
  const [entrySubmitAttempted, setEntrySubmitAttempted] = useState(false);
  const [saveEntryAsDefinition, setSaveEntryAsDefinition] = useState(false);
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

  const categoryManagementItems = useMemo(() => {
    if (adminPortal) {
      const adminCategories = Array.from(new Set(defaultDefinitions.map((definition) => definition.category))).sort();
      return adminCategories.map((category) => ({
        category,
        definitionCount: defaultDefinitions.filter((definition) => definition.category === category).length,
        entryCount: 0,
        isCustomOnly: false,
      }));
    }

    return categoryOptions.map((category) => ({
      category,
      definitionCount: definitions.filter((definition) => definition.category === category).length,
      entryCount: entries.filter((entry) => entry.category === category).length,
      isCustomOnly: customCategories.includes(category),
    }));
  }, [adminPortal, categoryOptions, customCategories, defaultDefinitions, definitions, entries]);

  const definitionOptionsForSelectedCategory = useMemo(() => {
    if (!entryDraft.category) {
      return [];
    }
    return definitions
      .filter((definition) => definition.is_active && definition.category === entryDraft.category)
      .sort((left, right) => left.doc_type.localeCompare(right.doc_type));
  }, [definitions, entryDraft.category]);

  const knownDocTypesForSelectedCategory = useMemo(() => {
    if (!entryDraft.category) {
      return [];
    }
    const values = new Set<string>();
    definitions
      .filter((definition) => definition.category === entryDraft.category && definition.is_active)
      .forEach((definition) => values.add(definition.doc_type));
    entries
      .filter((entry) => entry.category === entryDraft.category)
      .forEach((entry) => values.add(entry.doc_type));
    return Array.from(values).sort();
  }, [definitions, entries, entryDraft.category]);

  const selectedDefinition = useMemo(
    () => definitions.find((definition) => definition.id === entryDraft.definitionId) || null,
    [definitions, entryDraft.definitionId],
  );

  const entryCategorySelectValue = useMemo(() => {
    if (!entryDraft.category) {
      return '';
    }
    return categoryOptions.includes(entryDraft.category) ? entryDraft.category : NEW_CATEGORY_OPTION;
  }, [categoryOptions, entryDraft.category]);

  const entryDocTypeSelectValue = useMemo(() => {
    if (!entryDraft.docType) {
      return '';
    }
    return knownDocTypesForSelectedCategory.includes(entryDraft.docType) ? entryDraft.docType : NEW_DOC_TYPE_OPTION;
  }, [entryDraft.docType, knownDocTypesForSelectedCategory]);

  const locationOptions = useMemo(() => {
    const options = new Set(folderOptions);
    if (entryDraft.folderLabel.trim()) {
      options.add(entryDraft.folderLabel.trim());
    }
    return Array.from(options).sort();
  }, [entryDraft.folderLabel, folderOptions]);

  const selectedCategoryTypes = useMemo(() => {
    if (!selectedBrowseCategory) {
      return [] as Array<{
        key: string;
        category: string;
        docType: string;
        definition: DocumentTypeDefinition | null;
        entries: DocumentEntry[];
      }>;
    }

    const entriesForCategory = entries.filter((entry) => entry.category === selectedBrowseCategory);
    const definitionsForCategory = definitions.filter(
      (definition) => definition.category === selectedBrowseCategory && definition.is_active,
    );

    const allTypeNames = new Set<string>();
    definitionsForCategory.forEach((definition) => allTypeNames.add(definition.doc_type));
    entriesForCategory.forEach((entry) => allTypeNames.add(entry.doc_type));

    return Array.from(allTypeNames)
      .map((docType) => ({
        key: `${selectedBrowseCategory}::${docType}`,
        category: selectedBrowseCategory,
        docType,
        definition: definitionsForCategory.find((definition) => definition.doc_type === docType) || null,
        entries: entriesForCategory
          .filter((entry) => entry.doc_type === docType)
          .sort((left, right) => {
            const leftDate = new Date(left.updated_at || left.created_at).getTime();
            const rightDate = new Date(right.updated_at || right.created_at).getTime();
            return rightDate - leftDate;
          }),
      }))
      .sort((left, right) => {
        if (right.entries.length !== left.entries.length) {
          return right.entries.length - left.entries.length;
        }
        return left.docType.localeCompare(right.docType);
      });
  }, [definitions, entries, selectedBrowseCategory]);

  const selectedBrowseType = useMemo(
    () => selectedCategoryTypes.find((item) => item.docType === selectedBrowseDocType) || null,
    [selectedBrowseDocType, selectedCategoryTypes],
  );

  const selectedCategoryDefinitions = useMemo(
    () =>
      definitions
        .filter((definition) => definition.category === selectedBrowseCategory && definition.is_active)
        .sort((left, right) => left.doc_type.localeCompare(right.doc_type)),
    [definitions, selectedBrowseCategory],
  );

  const flattenFolderPaths = (items: FolderStructureItem[], prefix = ''): string[] => {
    return items.flatMap((item) => {
      const path = prefix ? `${prefix} / ${item.name}` : item.name;
      const nested = item.children?.length ? flattenFolderPaths(item.children, path) : [];
      return [path, ...nested];
    });
  };

  const guessFolderLocation = (
    category: string,
    docType: string,
    options: string[],
  ) => {
    const exactPath = docType === category ? category : `${category} / ${docType}`;
    if (options.includes(exactPath)) {
      return exactPath;
    }

    const hintKey = `${category}::${docType}`;
    const hinted = FOLDER_LOCATION_HINTS[hintKey]?.find((option) => options.includes(option));
    if (hinted) {
      return hinted;
    }

    const tokens = `${category} ${docType}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean);

    let bestOption = '';
    let bestScore = -1;
    for (const option of options) {
      const normalizedOption = option.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (normalizedOption.includes(token)) {
          score += token.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }

    return bestScore > 0 ? bestOption : '';
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
    const suggestedPath = guessFolderLocation(selectedDefinition.category, selectedDefinition.doc_type, locationOptions);
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
        folderLabel: suggestedPath || current.folderLabel,
        metadata: nextMetadata,
      };
    });
  }, [locationOptions, selectedDefinition]);

  useEffect(() => {
    if (categoryFilter && categoryOptions.includes(categoryFilter)) {
      setSelectedBrowseCategory(categoryFilter);
      return;
    }
    if (selectedBrowseCategory && !categoryOptions.includes(selectedBrowseCategory)) {
      setSelectedBrowseCategory('');
    }
  }, [categoryFilter, categoryOptions, selectedBrowseCategory]);

  useEffect(() => {
    if (!selectedBrowseDocType) {
      return;
    }
    const docTypeStillExists = selectedCategoryTypes.some((item) => item.docType === selectedBrowseDocType);
    if (!docTypeStillExists) {
      setSelectedBrowseDocType('');
    }
  }, [selectedBrowseDocType, selectedCategoryTypes]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timeout = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const resetEntryModal = () => {
    setEntryDraft(EMPTY_ENTRY);
    setVisibleSensitiveModalFields({});
    setEntrySubmitAttempted(false);
    setSaveEntryAsDefinition(false);
    setShowEntryModal(false);
  };

  useEffect(() => {
    if (!location.state?.documentVaultResetAt) {
      return;
    }

    setActiveTab(initialTab);
    setSearch('');
    setCategoryFilter('');
    setDocTypeFilter('');
    setError('');
    setMessage('');
    setShowSearchBar(false);
    setShowDefaultsTooltip(false);
    setShowCategoryModal(false);
    setShowManageCategoriesModal(false);
    setSelectedBrowseCategory('');
    setSelectedBrowseDocType('');
    setVisibleSensitiveFields({});
    resetEntryModal();
  }, [initialTab, location.state?.documentVaultResetAt]);

  const resetDefinitionModal = () => {
    setDefinitionDraft(EMPTY_DEFINITION);
    setShowDefinitionModal(false);
  };

  const resetDefaultDefinitionModal = () => {
    setDefaultDefinitionDraft(EMPTY_DEFINITION);
    setShowDefaultDefinitionModal(false);
  };

  const openCreateEntry = (category = '', docType = '') => {
    setMessage('');
    setError('');
    setVisibleSensitiveModalFields({});
    setEntrySubmitAttempted(false);
    const matchingDefinition =
      category && docType
        ? definitions.find((definition) => definition.category === category && definition.doc_type === docType) || null
        : null;
    setEntryDraft({
      ...EMPTY_ENTRY,
      category,
      docType,
      definitionId: matchingDefinition?.id || null,
      folderLabel: category && docType ? guessFolderLocation(category, docType, folderOptions) : '',
    });
    setSaveEntryAsDefinition(false);
    setShowEntryModal(true);
  };

  const openEditEntry = (entry: DocumentEntry) => {
    setMessage('');
    setError('');
    setVisibleSensitiveModalFields({});
    setEntrySubmitAttempted(false);
    const matchingDefinition =
      definitions.find((definition) => definition.id === entry.definition_id) ||
      definitions.find((definition) => definition.category === entry.category && definition.doc_type === entry.doc_type) ||
      null;
    setEntryDraft({
      id: entry.id,
      title: entry.title,
      description: entry.description || '',
      notes: entry.notes || '',
      definitionId: matchingDefinition?.id || null,
      category: entry.category,
      docType: entry.doc_type,
      folderLabel: entry.folder_label || '',
      metadata: { ...(entry.metadata_json || {}) },
      file: null,
    });
    setSaveEntryAsDefinition(false);
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

  const closeManageCategoriesModal = () => {
    setShowManageCategoriesModal(false);
    setCategoryRenameDrafts({});
  };

  const closeManageTypesModal = () => {
    setShowManageTypesModal(false);
  };

  const openConfirmDialog = (dialog: ConfirmDialogState) => {
    setConfirmDialog(dialog);
  };

  const closeConfirmDialog = () => {
    if (confirmDialogLoading) {
      return;
    }
    setConfirmDialog(null);
  };

  const handleConfirmDialog = async () => {
    if (!confirmDialog) {
      return;
    }
    setConfirmDialogLoading(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmDialogLoading(false);
    }
  };

  const handleRenameCategory = async (category: string) => {
    const renamed = (categoryRenameDrafts[category] ?? category).trim();
    if (!renamed) {
      setError('Category name is required.');
      return;
    }
    if (renamed === category) {
      return;
    }
    const matchingDefinitions = adminPortal
      ? defaultDefinitions.filter((definition) => definition.category === category)
      : definitions.filter((definition) => definition.category === category);
    const matchingEntries = adminPortal ? [] : entries.filter((entry) => entry.category === category);
    const isCustomCategory = customCategories.includes(category);
    const isMerge = category !== renamed && categoryManagementItems.some((item) => item.category === renamed);

    if (
      !window.confirm(
        `Rename "${category}" to "${renamed}"? This updates ${matchingDefinitions.length} document type(s) and ${matchingEntries.length} vault entr${matchingEntries.length === 1 ? 'y' : 'ies'}${isMerge ? ' and merges them into an existing category' : ''}.`,
      )
    ) {
      return;
    }

    setError('');
    try {
      await Promise.all([
        ...matchingDefinitions.map((definition) =>
          (adminPortal ? DocumentsService.updateDefaultDefinition(definition.id, {
            category: renamed,
          }) : DocumentsService.updateDefinition(definition.id, {
            category: renamed,
          })),
        ),
        ...matchingEntries.map((entry) =>
          DocumentsService.updateEntry(entry.id, {
            category: renamed,
          }),
        ),
      ]);

      if (!adminPortal) {
        setCustomCategories((current) => {
          const next = current.filter((item) => item !== category);
          if (isCustomCategory || (!matchingDefinitions.length && !matchingEntries.length)) {
            next.push(renamed);
          }
          return Array.from(new Set(next)).sort();
        });
      }
      setCategoryRenameDrafts((current) => {
        const next = { ...current };
        delete next[category];
        return next;
      });
      if (!adminPortal) {
        setCategoryFilter((current) => (current === category ? renamed : current));
        setSelectedBrowseCategory((current) => (current === category ? renamed : current));
        setEntryDraft((current) => ({
          ...current,
          category: current.category === category ? renamed : current.category,
        }));
        setDefinitionDraft((current) => ({
          ...current,
          category: current.category === category ? renamed : current.category,
        }));
        await Promise.all([loadDefinitions(), loadEntries()]);
      } else {
        setDefaultDefinitionDraft((current) => ({
          ...current,
          category: current.category === category ? renamed : current.category,
        }));
        await loadDefaultDefinitions();
      }

      setMessage(`Category "${category}" ${isMerge ? `merged into "${renamed}"` : `renamed to "${renamed}"`}.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to rename category.');
    }
  };

  const handleDeleteCategory = async (category: string) => {
    const matchingDefinitions = adminPortal
      ? defaultDefinitions.filter((definition) => definition.category === category)
      : definitions.filter((definition) => definition.category === category);
    const matchingEntries = adminPortal ? [] : entries.filter((entry) => entry.category === category);

    setError('');
    try {
      await Promise.all([
        ...matchingDefinitions.map((definition) =>
          adminPortal
            ? DocumentsService.deleteDefaultDefinition(definition.id)
            : DocumentsService.deleteDefinition(definition.id),
        ),
        ...matchingEntries.map((entry) => DocumentsService.deleteEntry(entry.id)),
      ]);

      if (!adminPortal) {
        setCustomCategories((current) => current.filter((item) => item !== category));
        setCategoryFilter((current) => (current === category ? '' : current));
        setSelectedBrowseCategory((current) => (current === category ? '' : current));
        await Promise.all([loadDefinitions(), loadEntries()]);
      } else {
        await loadDefaultDefinitions();
      }

      setCategoryRenameDrafts((current) => {
        const next = { ...current };
        delete next[category];
        return next;
      });
      setMessage(`Category "${category}" deleted.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete category.');
    }
  };

  const handleEntryCategoryChange = (category: string) => {
    if (category === NEW_CATEGORY_OPTION) {
      setEntryDraft((current) => ({
        ...current,
        category: '',
        docType: '',
        definitionId: null,
        folderLabel: '',
        metadata: {},
      }));
      return;
    }

    setEntryDraft((current) => ({
      ...current,
      category,
      docType: '',
      definitionId: null,
      folderLabel: category ? guessFolderLocation(category, '', locationOptions) || '' : '',
      metadata: {},
    }));
  };

  const handleEntryDocTypeChange = (docType: string) => {
    if (!docType) {
      setEntryDraft((current) => ({
        ...current,
        definitionId: null,
        docType: '',
        metadata: {},
      }));
      return;
    }
    if (docType === NEW_DOC_TYPE_OPTION) {
      setEntryDraft((current) => ({
        ...current,
        definitionId: null,
        docType: '',
        metadata: {},
      }));
      return;
    }

    const definition =
      definitions.find((item) => item.category === entryDraft.category && item.doc_type === docType && item.is_active) || null;

    if (!entryDraft.category) {
      return;
    }

    setEntryDraft((current) => ({
      ...current,
      definitionId: definition?.id || null,
      category: current.category,
      docType,
      folderLabel: guessFolderLocation(current.category, docType, locationOptions) || current.folderLabel,
      metadata: {},
    }));
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
    setEntrySubmitAttempted(true);
    const trimmedTitle = entryDraft.title.trim();
    const trimmedCategory = entryDraft.category.trim();
    const trimmedDocType = entryDraft.docType.trim();

    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }
    if (!trimmedCategory || !trimmedDocType) {
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
      let resolvedDefinitionId = entryDraft.definitionId;
      const existingDefinition =
        definitions.find(
          (definition) => definition.category === trimmedCategory && definition.doc_type === trimmedDocType && definition.is_active,
        ) || null;

      if (!resolvedDefinitionId && existingDefinition) {
        resolvedDefinitionId = existingDefinition.id;
      }

      if (!entryDraft.id && saveEntryAsDefinition && !resolvedDefinitionId) {
        const createdDefinition = await DocumentsService.createDefinition(
          {
            category: trimmedCategory,
            doc_type: trimmedDocType,
            description: null,
            fields_config: [],
            is_active: true,
          },
          viewingUserId,
        );
        resolvedDefinitionId = createdDefinition.id;
        await loadDefinitions();
      }

      let savedEntry: DocumentEntry;
      if (entryDraft.id) {
        savedEntry = await DocumentsService.updateEntry(entryDraft.id, {
          definition_id: resolvedDefinitionId,
          category: trimmedCategory,
          doc_type: trimmedDocType,
          title: trimmedTitle,
          description: entryDraft.description.trim() || null,
          notes: entryDraft.notes.trim() || null,
          metadata_json: entryDraft.metadata,
          folder_label: entryDraft.folderLabel.trim() || null,
        });
      } else {
        savedEntry = await DocumentsService.createEntry({
          title: trimmedTitle,
          category: trimmedCategory,
          docType: trimmedDocType,
          definitionId: resolvedDefinitionId,
          description: entryDraft.description.trim() || null,
          notes: entryDraft.notes.trim() || null,
          folderLabel: entryDraft.folderLabel.trim() || null,
          metadataJson: entryDraft.metadata,
          viewingUserId,
          file: entryDraft.file,
        });
      }
      setEntries((current) => {
        const remaining = current.filter((entry) => entry.id !== savedEntry.id);
        return [savedEntry, ...remaining].sort((left, right) => {
          const leftDate = new Date(left.updated_at || left.created_at).getTime();
          const rightDate = new Date(right.updated_at || right.created_at).getTime();
          return rightDate - leftDate;
        });
      });
      setSelectedBrowseCategory(trimmedCategory);
      setSelectedBrowseDocType(trimmedDocType);
      void loadEntries();
      setMessage(`Vault entry ${entryDraft.id ? 'updated' : 'created'}.`);
      resetEntryModal();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save vault entry.');
    }
  };

  const handleDeleteEntry = async (entry: DocumentEntry) => {
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

  const formatMetadataDisplayValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  const toggleSensitiveFieldVisibility = (entryId: number, fieldId: string) => {
    const key = `${entryId}:${fieldId}`;
    setVisibleSensitiveFields((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const toggleSensitiveModalFieldVisibility = (fieldId: string) => {
    setVisibleSensitiveModalFields((current) => ({
      ...current,
      [fieldId]: !current[fieldId],
    }));
  };

  const renderRecordMetadata = (entry: DocumentEntry, definition: DocumentTypeDefinition | null) => {
    const metadata = entry.metadata_json || {};
    const configuredFields = (definition?.fields_config || []).filter((field) => !field.hidden);

    const configuredItems = configuredFields
      .map((field) => ({
        id: field.id,
        label: field.label || field.id,
        value: metadata[field.id],
        isSensitive: Boolean(field.is_sensitive),
      }))
      .filter((item) => {
        if (item.value == null || item.value === '') {
          return false;
        }
        if (Array.isArray(item.value)) {
          return item.value.length > 0;
        }
        return true;
      });

    const configuredKeys = new Set(configuredItems.map((item) => item.id));
    const extraItems = Object.entries(metadata)
      .filter(([key, value]) => {
        if (configuredKeys.has(key)) {
          return false;
        }
        if (value == null || value === '') {
          return false;
        }
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return true;
      })
      .map(([key, value]) => ({
        id: key,
        label: key,
        value,
        isSensitive: false,
      }));

    return [...configuredItems, ...extraItems].map((item) => {
      const visibilityKey = `${entry.id}:${item.id}`;
      const isVisible = Boolean(visibleSensitiveFields[visibilityKey]);
      const displayValue = item.isSensitive && !isVisible ? '••••••' : formatMetadataDisplayValue(item.value);

      return (
        <span key={visibilityKey} className="vault-chip vault-chip-sensitive-wrap">
          <span>
            {item.label}: {displayValue}
          </span>
          {item.isSensitive && (
            <button
              type="button"
              className="vault-chip-toggle"
              onClick={() => toggleSensitiveFieldVisibility(entry.id, item.id)}
              aria-label={isVisible ? `Hide ${item.label}` : `View ${item.label}`}
              title={isVisible ? 'Hide value' : 'View value'}
            >
              {isVisible ? 'Hide' : 'View'}
            </button>
          )}
        </span>
      );
    });
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
    const isSensitiveVisible = Boolean(visibleSensitiveModalFields[field.id]);

    if (field.hidden) {
      return null;
    }

    if (field.field_type === 'textarea') {
      const textarea = (
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
          style={field.is_sensitive && !isSensitiveVisible ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties) : undefined}
        />
      );

      if (!field.is_sensitive) {
        return textarea;
      }

      return (
        <div className="vault-sensitive-input-wrap">
          {textarea}
          <button
            type="button"
            className="vault-sensitive-toggle-button"
            onClick={() => toggleSensitiveModalFieldVisibility(field.id)}
          >
            {isSensitiveVisible ? 'Hide' : 'View'}
          </button>
        </div>
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
            name="vault-boolean-field"
            autoComplete="off"
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
                : field.is_sensitive && !isSensitiveVisible
                  ? 'password'
                  : 'text';

    const input = (
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

    if (!field.is_sensitive) {
      return input;
    }

    return (
      <div className="vault-sensitive-input-wrap">
        {input}
        <button
          type="button"
          className="vault-sensitive-toggle-button"
          onClick={() => toggleSensitiveModalFieldVisibility(field.id)}
        >
          {isSensitiveVisible ? 'Hide' : 'View'}
        </button>
      </div>
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
              <button
                onClick={() =>
                  openConfirmDialog({
                    title: isDefault ? 'Delete Recommended Default' : 'Delete Document Type',
                    message: `Delete "${definition.doc_type}"?`,
                    confirmLabel: 'Delete',
                    onConfirm: () => handleDeleteDefinition(definition, isDefault),
                  })
                }
                className="btn-icon"
                title="Delete"
              >
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
              name="vault-boolean-field"
              autoComplete="off"
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
                      name="vault-boolean-field"
                      autoComplete="off"
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
          {currentUser?.is_admin && adminPortal && (
            <button className="btn-secondary" onClick={openCreateDefaultDefinition}>
              + New Recommended Default
            </button>
          )}
        </div>
        {!!message && <div className="vault-notice vault-notice-success">{message}</div>}
      </div>

      {!adminPortal && (
        <>
          <div className="vault-toolbar">
            <div className="vault-toolbar-left">
              <button className="btn-secondary" onClick={() => setShowSearchBar((current) => !current)}>
                {showSearchBar ? 'Hide Search' : 'Search Records'}
              </button>
            </div>
            <div className="vault-toolbar-right">
              <div className="default-folders-tooltip-container">
                <button className="btn-secondary" onClick={() => void handleLoadRecommendedDefaults()}>
                  Load Defaults
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
              {currentUser?.is_admin && activeTab !== 'defaults' && (
                <button className="btn-secondary" onClick={() => setActiveTab('defaults')}>
                  Manage
                </button>
              )}
              {currentUser?.is_admin && activeTab === 'defaults' && (
                <button className="btn-secondary" onClick={() => setActiveTab('entries')}>
                  Back to Vault
                </button>
              )}
            </div>
          </div>

          {showSearchBar && (
            <div className="vault-filter-grid">
              <input
                className="form-input"
                name="vault-search"
                autoComplete="off"
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
        </>
      )}

      {adminPortal && (
        <div className="vault-notice vault-notice-info">
          Admin portal: manage the recommended default document types that are preloaded for new users. Existing users can
          still add missing defaults later without overwriting existing data.
        </div>
      )}

      {loading && <div className="loading">Loading document vault...</div>}
      {!!error && <div className="error">{error}</div>}

      {!loading && !error && !adminPortal && activeTab !== 'defaults' && (
        <div className="vault-browser-layout">
          <aside className="vault-category-sidebar">
            <div className="vault-browser-header">
              <div>
                <h3>Categories</h3>
              </div>
              <div className="vault-inline-actions">
                <button className="btn-secondary" onClick={() => setShowManageCategoriesModal(true)}>
                  Manage
                </button>
              </div>
            </div>
            <div className="vault-category-list">
              {categoryManagementItems.map((item) => (
                <button
                  key={item.category}
                  className={selectedBrowseCategory === item.category ? 'vault-category-button vault-category-button-active' : 'vault-category-button'}
                  onClick={() => {
                    setSelectedBrowseCategory(item.category);
                    setSelectedBrowseDocType('');
                  }}
                >
                  <span>{item.category}</span>
                  <span className="vault-category-count">{item.entryCount}</span>
                </button>
              ))}
              {categoryManagementItems.length === 0 && (
                <div className="empty-state" style={{ marginTop: 0 }}>
                  <p>No categories yet.</p>
                </div>
              )}
            </div>
          </aside>

          <section className="vault-type-panel">
            {selectedBrowseCategory ? (
              <>
                <div className="vault-browser-header">
                  <div>
                    <h3>{selectedBrowseCategory}</h3>
                    <p className="vault-helper-text">
                      {selectedCategoryTypes.length} document type{selectedCategoryTypes.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="vault-inline-actions">
                    <button className="btn-secondary" onClick={() => setShowManageTypesModal(true)}>
                      Manage
                    </button>
                  </div>
                </div>
                {selectedCategoryTypes.length === 0 ? (
                  <div className="empty-state">
                    <p>No document types yet in this category.</p>
                    <p>Add a document type to get started.</p>
                  </div>
                ) : (
                  <>
                    {selectedBrowseType ? (
                      <div className="vault-type-section">
                        <div className="vault-type-section-header">
                          <div className="vault-inline-actions">
                            <button className="btn-icon" onClick={() => setSelectedBrowseDocType('')} title="Back to document types">
                              ←
                            </button>
                            <h4>{selectedBrowseType.docType}</h4>
                          </div>
                          <div className="vault-inline-actions">
                            <button
                              className="btn-icon"
                              onClick={() => openCreateEntry(selectedBrowseType.category, selectedBrowseType.docType)}
                              title="Add record"
                            >
                              +
                            </button>
                            {selectedBrowseType.definition && (
                              <button
                                className="btn-icon"
                                onClick={() => openEditDefinition(selectedBrowseType.definition!)}
                                title="Edit document type"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        </div>
                        {selectedBrowseType.entries.length === 0 ? (
                          <div className="empty-state">
                            <p>No records yet for this document type.</p>
                          </div>
                        ) : (
                          <div className="vault-record-list">
                            {selectedBrowseType.entries.map((entry) => (
                              <div key={entry.id} className="vault-record-card">
                                <div className="vault-record-card-main">
                                  <div className="vault-record-card-header">
                                    <strong>{entry.title}</strong>
                                    <span className="vault-subtle-text">{formatDate(entry.updated_at || entry.created_at)}</span>
                                  </div>
                                  {entry.description && <div className="vault-subtle-text">{entry.description}</div>}
                                  {entry.notes && <div className="vault-subtle-text">{entry.notes}</div>}
                                  <div className="vault-chip-row">
                                    {entry.folder_label && <span className="vault-chip">{entry.folder_label}</span>}
                                    {entry.file_name && <span className="vault-chip">{entry.file_name}</span>}
                                    {renderRecordMetadata(entry, selectedBrowseType.definition)}
                                  </div>
                                </div>
                                <div className="vault-record-card-actions">
                                  {entry.file_name && (
                                    <button onClick={() => void handleDownloadEntry(entry)} className="btn-icon" title="Download">
                                      ⬇️
                                    </button>
                                  )}
                                  <button onClick={() => openEditEntry(entry)} className="btn-icon" title="Edit">
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() =>
                                      openConfirmDialog({
                                        title: 'Delete Record',
                                        message: `Delete "${entry.title}"?`,
                                        confirmLabel: 'Delete',
                                        onConfirm: () => handleDeleteEntry(entry),
                                      })
                                    }
                                    className="btn-icon"
                                    title="Delete"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="vault-type-list-simple">
                        {selectedCategoryTypes.map((item) => (
                          <button
                            key={item.key}
                            className="vault-type-button"
                            onClick={() => setSelectedBrowseDocType(item.docType)}
                          >
                            <span>{item.docType}</span>
                            <span className="vault-category-count">{item.entries.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>Select a category to see document types.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && !error && activeTab === 'defaults' && currentUser?.is_admin && (
        <div className="documents-content">
          <div style={{ marginBottom: '16px', color: '#475569' }}>
            Active recommended defaults are prepopulated for new users. Existing users can load missing ones with
            `Load Recommended Defaults` and it will not overwrite existing data.
          </div>
          <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={openCreateDefaultDefinition}>
              + New Recommended Default
            </button>
            <button className="btn-secondary" onClick={() => setShowManageCategoriesModal(true)}>
              Manage Categories
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
          <form
            className="modal-content"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveEntry();
            }}
            style={{ maxWidth: '860px' }}
          >
            <h2>{entryDraft.id ? 'Edit Vault Entry' : 'New Vault Entry'}</h2>
            {!!error && <div className="vault-notice vault-notice-error">{error}</div>}
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <select
                className="form-input"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={entryCategorySelectValue}
                onChange={(event) => handleEntryCategoryChange(event.target.value)}
              >
                <option value="">Select category...</option>
                <option value={NEW_CATEGORY_OPTION}>+ New category...</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {entryCategorySelectValue === NEW_CATEGORY_OPTION && (
                <input
                  className="form-input"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={entryDraft.category}
                  onChange={(event) =>
                    setEntryDraft((current) => ({
                      ...current,
                      category: event.target.value,
                      docType: '',
                      definitionId: null,
                      folderLabel: '',
                      metadata: {},
                    }))
                  }
                  placeholder="New category name"
                />
              )}
              <select
                className="form-input"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={entryDocTypeSelectValue}
                onChange={(event) => handleEntryDocTypeChange(event.target.value)}
                disabled={!entryDraft.category}
              >
                <option value="">{entryDraft.category ? 'Select document type...' : 'Select category first...'}</option>
                <option value={NEW_DOC_TYPE_OPTION}>+ New document type...</option>
                {knownDocTypesForSelectedCategory.map((docType) => (
                  <option key={docType} value={docType}>
                    {docType}
                  </option>
                ))}
              </select>
              {entryDraft.category && entryDocTypeSelectValue === NEW_DOC_TYPE_OPTION && (
                <input
                  className="form-input"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={entryDraft.docType}
                  onChange={(event) =>
                    setEntryDraft((current) => ({
                      ...current,
                      docType: event.target.value,
                      definitionId: null,
                      folderLabel: guessFolderLocation(current.category, event.target.value, locationOptions) || current.folderLabel,
                      metadata: {},
                    }))
                  }
                  placeholder="New document type name"
                />
              )}
              <div>
                <input
                  className="form-input"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={entryDraft.title}
                  onChange={(event) => setEntryDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Title"
                  style={{ marginBottom: 0 }}
                />
                {entrySubmitAttempted && !entryDraft.title.trim() && (
                  <div className="vault-helper-text vault-helper-text-error">Title is required.</div>
                )}
              </div>
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

            {!entryDraft.id && entryDraft.category.trim() && entryDraft.docType.trim() && !selectedDefinition && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <input
                  name="vault-boolean-field"
                  autoComplete="off"
                  type="checkbox"
                  checked={saveEntryAsDefinition}
                  onChange={(event) => setSaveEntryAsDefinition(event.target.checked)}
                />
                Save this as a reusable document type for future records
              </label>
            )}

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
              rows={3}
              value={entryDraft.notes}
              onChange={(event) => setEntryDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notes"
              style={{ marginTop: '12px' }}
            />
            {!entryDraft.id && (
              <>
                <input
                  name="vault-file-input"
                  autoComplete="off"
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
              <button type="button" onClick={resetEntryModal} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Entry
              </button>
            </div>
          </form>
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
      {showManageCategoriesModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '760px' }}>
            <h2>{adminPortal ? 'Manage Default Categories' : 'My Categories'}</h2>
            <p className="vault-helper-text">
              {adminPortal
                ? 'Rename categories here to update recommended default document types. Renaming into an existing category merges the defaults together.'
                : 'Rename categories here to update your document types and vault entries. Renaming into an existing category merges them together.'}
            </p>
            {!adminPortal && (
              <div style={{ marginTop: '12px', marginBottom: '16px' }}>
                <button className="btn-secondary" onClick={() => setShowCategoryModal(true)}>
                  + Add Category
                </button>
              </div>
            )}
            {categoryManagementItems.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '12px' }}>
                <p>{adminPortal ? 'No default categories yet.' : 'No categories yet.'}</p>
              </div>
            ) : (
              <div className="vault-category-manager">
                {categoryManagementItems.map((item) => (
                  <div key={item.category} className="vault-category-row">
                    <div className="vault-category-row-main">
                      <input
                        className="form-input"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        value={categoryRenameDrafts[item.category] ?? item.category}
                        onChange={(event) =>
                          setCategoryRenameDrafts((current) => ({
                            ...current,
                            [item.category]: event.target.value,
                          }))
                        }
                        placeholder="Category name"
                        style={{ marginBottom: 0 }}
                      />
                      <div className="vault-chip-row">
                        <span className="vault-chip">{item.definitionCount} document type{item.definitionCount === 1 ? '' : 's'}</span>
                        <span className="vault-chip">{item.entryCount} entr{item.entryCount === 1 ? 'y' : 'ies'}</span>
                        {item.isCustomOnly && <span className="vault-chip">custom</span>}
                      </div>
                    </div>
                    <div className="vault-category-row-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void handleRenameCategory(item.category)}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          const confirmMessage =
                            item.definitionCount || item.entryCount
                              ? `Delete category "${item.category}" and everything inside it? This will permanently delete ${item.definitionCount} document type(s) and ${item.entryCount} vault entr${item.entryCount === 1 ? 'y' : 'ies'}.`
                              : `Delete empty category "${item.category}"?`;
                          openConfirmDialog({
                            title: 'Delete Category',
                            message: confirmMessage,
                            confirmLabel: 'Delete',
                            onConfirm: () => handleDeleteCategory(item.category),
                          });
                        }}
                        title={
                          item.definitionCount > 0 || item.entryCount > 0
                            ? 'Delete this category and everything inside it.'
                            : 'Delete category'
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={closeManageCategoriesModal} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showManageTypesModal && selectedBrowseCategory && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '760px' }}>
            <h2>Manage Document Types</h2>
            <p className="vault-helper-text">Manage document types in {selectedBrowseCategory}.</p>
            <div style={{ marginTop: '12px', marginBottom: '16px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  closeManageTypesModal();
                  openCreateDefinitionForCategory(selectedBrowseCategory);
                }}
              >
                + Add Document Type
              </button>
            </div>
            {selectedCategoryDefinitions.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '12px' }}>
                <p>No document types yet.</p>
              </div>
            ) : (
              <div className="vault-category-manager">
                {selectedCategoryDefinitions.map((definition) => {
                  const matchingType = selectedCategoryTypes.find((item) => item.docType === definition.doc_type);
                  const recordCount = matchingType?.entries.length || 0;
                  return (
                    <div key={definition.id} className="vault-category-row">
                      <div className="vault-category-row-main">
                        <div style={{ fontWeight: 600 }}>{definition.doc_type}</div>
                        <div className="vault-chip-row">
                          <span className="vault-chip">{recordCount} record{recordCount === 1 ? '' : 's'}</span>
                          <span className="vault-chip">{definition.fields_config.length} field{definition.fields_config.length === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                      <div className="vault-category-row-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => {
                            closeManageTypesModal();
                            openCreateEntry(selectedBrowseCategory, definition.doc_type);
                          }}
                          title="Add record"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => {
                            closeManageTypesModal();
                            openEditDefinition(definition);
                          }}
                          title="Edit document type"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() =>
                            openConfirmDialog({
                              title: 'Delete Document Type',
                              message: `Delete "${definition.doc_type}"?`,
                              confirmLabel: 'Delete',
                              onConfirm: () => handleDeleteDefinition(definition, false),
                            })
                          }
                          title="Delete document type"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={closeManageTypesModal} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h2>{confirmDialog.title}</h2>
            <p className="vault-helper-text" style={{ marginTop: 0 }}>
              {confirmDialog.message}
            </p>
            <div className="modal-actions">
              <button onClick={closeConfirmDialog} className="btn-secondary" disabled={confirmDialogLoading}>
                Cancel
              </button>
              <button onClick={() => void handleConfirmDialog()} className="btn-primary" disabled={confirmDialogLoading}>
                {confirmDialog.confirmLabel || 'Confirm'}
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

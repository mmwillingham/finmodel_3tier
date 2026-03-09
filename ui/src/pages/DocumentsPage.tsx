import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DocumentsService from '../services/documents.service';
import SettingsService from '../services/settings.service';
import ConfirmDialog from '../components/ConfirmDialog';
import AccountSwitcher from '../components/AccountSwitcher';
import './DocumentsPage.css';
import '../components/SidebarLayout.css';

const DocumentsPage = ({ hideSidebar = false }: any) => {
  const { currentUser, viewingUserId } = useAuth();
  const [folders, setFolders] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<any>(null);
  const [folderPath, setFolderPath] = useState([{ id: null, name: 'Root' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);
  
  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Form states
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadFile, setUploadFile] = useState<any>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [editItem, setEditItem] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [defaultFoldersLoading, setDefaultFoldersLoading] = useState(false);
  const [defaultFoldersMessage, setDefaultFoldersMessage] = useState('');
  const [showDefaultFoldersTooltip, setShowDefaultFoldersTooltip] = useState(false);
  
  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<any>({ isOpen: false, title: '', message: '', onConfirm: null, showCancel: false });
  
  // Walkthrough
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [folderWarningMessage, setFolderWarningMessage] = useState('');
  const [showFolderWarningModal, setShowFolderWarningModal] = useState(false);

  useEffect(() => {
    loadFolderContents(currentFolderId);
  }, [currentFolderId, viewingUserId]);

  useEffect(() => {
    let isMounted = true;
    const loadLimits = async () => {
      try {
        const response = await SettingsService.getSubscriptionLimits();
        if (isMounted) {
          setLimits(response.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setLimits(null);
        }
      }
    };
    loadLimits();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadFolderContents = async (folderId: any) => {
    setLoading(true);
    setError(null);
    try {
      // Use viewingUserId if set, otherwise use currentUser.id (null means own account)
      const userIdToView = viewingUserId || null;
      const [foldersData, documentsData] = await Promise.all([
        DocumentsService.listFolders(folderId, userIdToView),
        DocumentsService.listDocuments(folderId, userIdToView)
      ]);
      setFolders(foldersData);
      setDocuments(documentsData);
    } catch (err: any) {
      setError('Failed to load folder contents');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = async (folder: any) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: any) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1].id);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('Please enter a folder name');
      return;
    }
    
    try {
      await DocumentsService.createFolder(newFolderName, currentFolderId);
      setNewFolderName('');
      setShowNewFolderModal(false);
      loadFolderContents(currentFolderId);
    } catch (err: any) {
      alert('Failed to create folder: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAddDefaultFolders = async () => {
    setShowDefaultFoldersTooltip(false);
    setDefaultFoldersMessage('');
    setDefaultFoldersLoading(true);
    try {
      const response = await DocumentsService.addDefaultFolders();
      setDefaultFoldersMessage(response.message || 'Default folders processed.');
      setCurrentFolderId(null);
      setFolderPath([{ id: null, name: 'Root' }]);
      loadFolderContents(null);
    } catch (err: any) {
      setDefaultFoldersMessage(err.response?.data?.detail || err.message || 'Failed to add default folders.');
    } finally {
      setDefaultFoldersLoading(false);
    }
  };

  const closeFolderWarningModal = () => {
    setShowFolderWarningModal(false);
    setFolderWarningMessage('');
  };

  const handleUploadDocument = async () => {
    if (!uploadFile) {
      alert('Please select a file');
      return;
    }
    
    try {
      await DocumentsService.uploadDocument(
        uploadFile,
        uploadName || null,
        uploadDescription || null,
        currentFolderId
      );
      setUploadFile(null);
      setUploadName('');
      setUploadDescription('');
      setShowUploadModal(false);
      loadFolderContents(currentFolderId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to upload document');
    }
  };

  const handleEditItem = (item: any, isFolder: any) => {
    setEditItem({ ...item, isFolder });
    setEditName(item.name);
    setEditDescription(item.description || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      alert('Please enter a name');
      return;
    }
    
    try {
      if (editItem.isFolder) {
        await DocumentsService.updateFolder(editItem.id, { name: editName });
      } else {
        await DocumentsService.updateDocument(editItem.id, {
          name: editName,
          description: editDescription
        });
      }
      setShowEditModal(false);
      setEditItem(null);
      loadFolderContents(currentFolderId);
    } catch (err: any) {
      alert('Failed to update: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteFolder = (folder: any) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete "${folder.name}" and all its contents?`,
      onConfirm: async () => {
        try {
          await DocumentsService.deleteFolder(folder.id);
          loadFolderContents(currentFolderId);
        } catch (err: any) {
          setFolderWarningMessage('Failed to delete folder: ' + (err.response?.data?.detail || err.message));
          setShowFolderWarningModal(true);
        }
      },
      showCancel: true
    });
  };

  const handleDeleteDocument = (document: any) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document',
      message: `Are you sure you want to delete "${document.name}"?`,
      onConfirm: async () => {
        try {
          await DocumentsService.deleteDocument(document.id);
          loadFolderContents(currentFolderId);
        } catch (err: any) {
          alert('Failed to delete document: ' + (err.response?.data?.detail || err.message));
        }
      },
      showCancel: true
    });
  };

  const handleDownloadDocument = async (document: any) => {
    try {
      await DocumentsService.downloadDocument(document.id, document.name);
    } catch (err: any) {
      alert('Failed to download document: ' + (err.response?.data?.detail || err.message));
    }
  };

  const formatFileSize = (bytes: any) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: any) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const location = useLocation();
  const navigate = useNavigate();

  const content = (
    <div className="documents-page">
          <div className="documents-header">
            <div className="documents-header-top">
              <h1 className="documents-title">📁 Documents</h1>
              <AccountSwitcher compact={true} />
            </div>
          <div className="documents-actions">
              <button onClick={() => setShowWalkthrough(true)} className="btn-primary" title="Show Tutorial">
                ❓ Tutorial
              </button>
              <button onClick={() => setShowNewFolderModal(true)} className="btn-primary">
                + New Folder
              </button>
              <button onClick={() => setShowUploadModal(true)} className="btn-primary">
                📤 Upload Document
              </button>
            <div className="default-folders-tooltip-container">
              <button
                onClick={handleAddDefaultFolders}
                className="btn-primary"
                disabled={defaultFoldersLoading}
                title="Add the recommended default Document Vault folders"
              >
                {defaultFoldersLoading ? 'Adding default folders...' : 'Add Default Folders'}
              </button>
              <button
                type="button"
                className="default-folders-tooltip-toggle"
                onClick={(e: any) => {
                  e.stopPropagation();
                  setShowDefaultFoldersTooltip((prev: any) => !prev);
                }}
                aria-expanded={showDefaultFoldersTooltip}
                aria-label="Show note about default folders"
              >
                i
              </button>
              {showDefaultFoldersTooltip && (
                <div className="default-folders-tooltip" role="tooltip">
                  Adds missing folders only; it won&apos;t remove or overwrite anything you already created.
                </div>
              )}
            </div>
            </div>
            {defaultFoldersMessage && (
              <div className="default-folders-message">
                {defaultFoldersMessage}
              </div>
            )}
          </div>

      {/* Breadcrumb navigation */}
      <div className="breadcrumb">
        {folderPath.map((folder: any, index: any) => (
          <span key={index}>
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className="breadcrumb-link"
            >
              {folder.name}
            </button>
            {index < folderPath.length - 1 && <span className="breadcrumb-separator"> / </span>}
          </span>
        ))}
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && (
        <div className="error">
          {error}
          {error.toLowerCase().includes('free plan') && (
            <div style={{ marginTop: '8px' }}>
              Upgrade on the <a href="/pricing">Pricing</a> page to upload more documents.
            </div>
          )}
        </div>
      )}

      {!loading && !error && (
        <div className="documents-content">
          {limits?.is_limited && limits.max_documents != null && (
            <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '12px' }}>
              Free plan: up to {limits.max_documents} documents.
            </div>
          )}
          {/* Folders */}
          {folders.length > 0 && (
            <div className="folders-section">
              <h3>Folders</h3>
              <div className="table-scroll">
              <table className="documents-table" style={{ marginBottom: '20px' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Owner</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {folders.map((folder: any) => (
                    <tr key={folder.id}>
                      <td>
                        <button 
                          onClick={() => handleFolderClick(folder)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#00a3e0', 
                            cursor: 'pointer',
                            textAlign: 'left',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          📁 {folder.name}
                        </button>
                      </td>
                      <td>
                        {folder.owner_email && folder.owner_id !== currentUser?.id ? (
                          folder.owner_email
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="actions-cell">
                        <button onClick={() => handleEditItem(folder, true)} className="btn-icon" title="Edit">
                          ✏️
                        </button>
                        <button onClick={() => handleDeleteFolder(folder)} className="btn-icon" title="Delete">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="documents-section">
              <h3>Documents</h3>
              <div className="table-scroll">
              <table className="documents-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Owner</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc: any) => (
                    <tr key={doc.id}>
                      <td>{doc.name}</td>
                      <td>{doc.owner_email || '-'}</td>
                      <td>{doc.description || '-'}</td>
                      <td>{doc.file_type || 'Unknown'}</td>
                      <td>{formatFileSize(doc.file_size)}</td>
                      <td>{formatDate(doc.created_at)}</td>
                      <td className="actions-cell">
                        <button onClick={() => handleDownloadDocument(doc)} className="btn-icon" title="Download">
                          ⬇️
                        </button>
                        <button onClick={() => handleEditItem(doc, false)} className="btn-icon" title="Edit">
                          ✏️
                        </button>
                        <button onClick={() => handleDeleteDocument(doc)} className="btn-icon" title="Delete">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {folders.length === 0 && documents.length === 0 && (
            <div className="empty-state">
              <p>This folder is empty</p>
              <p>Create a folder or upload a document to get started</p>
              <div className="empty-state-actions">
                <button onClick={() => setShowNewFolderModal(true)} className="btn-primary empty-state-button">
                  📁 Create Folder
                </button>
                <button onClick={() => setShowUploadModal(true)} className="btn-primary empty-state-button">
                  📤 Upload Document
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <h2>Create New Folder</h2>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e: any) => setNewFolderName(e.target.value)}
              className="form-input"
            />
            <div className="modal-actions">
              <button onClick={() => setShowNewFolderModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleCreateFolder} className="btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <h2>Upload Document</h2>
            <input
              type="file"
              onChange={(e: any) => setUploadFile(e.target.files[0])}
              className="form-input"
            />
            <input
              type="text"
              placeholder="Document name (optional)"
              value={uploadName}
              onChange={(e: any) => setUploadName(e.target.value)}
              className="form-input"
            />
            <textarea
              placeholder="Description (optional)"
              value={uploadDescription}
              onChange={(e: any) => setUploadDescription(e.target.value)}
              className="form-input"
              rows={3}
            />
            <div className="modal-actions">
              <button onClick={() => setShowUploadModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleUploadDocument} className="btn-primary">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e: any) => e.stopPropagation()}>
            <h2>Edit {editItem.isFolder ? 'Folder' : 'Document'}</h2>
            <input
              type="text"
              placeholder="Name"
              value={editName}
              onChange={(e: any) => setEditName(e.target.value)}
              className="form-input"
            />
            {!editItem.isFolder && (
              <textarea
                placeholder="Description"
                value={editDescription}
                onChange={(e: any) => setEditDescription(e.target.value)}
                className="form-input"
                rows={3}
              />
            )}
            <div className="modal-actions">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false, showCancel: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        showCancel={confirmDialog.showCancel}
      />
      {showFolderWarningModal && (
        <div className="modal-overlay" onClick={closeFolderWarningModal}>
          <div
            className="modal-content"
            onClick={(e: any) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h2>Unable to Delete Folder</h2>
            <p style={{ textAlign: 'center', color: '#e2e8f0', marginBottom: '20px' }}>
              {folderWarningMessage}
            </p>
            <div className="modal-actions">
              <button onClick={closeFolderWarningModal} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walkthrough Modal */}
      {showWalkthrough && (
        <div className="modal-overlay" onClick={() => setShowWalkthrough(false)}>
          <div className="modal-content walkthrough-modal" onClick={(e: any) => e.stopPropagation()}>
            <h2>📚 Document Vault Tutorial</h2>
            <div className="walkthrough-content">
              <div className="walkthrough-step">
                <h3>Step 1: Create a Folder</h3>
                <p>
                  1. Click the <strong>"+ New Folder"</strong> button at the top right<br/>
                  2. Enter a name for your folder (e.g., "Tax Documents", "Financial Statements")<br/>
                  3. Click "Create" to save the folder<br/>
                  4. Folders help you organize your documents into categories
                </p>
              </div>
              
              <div className="walkthrough-step">
                <h3>Step 2: Upload a Document</h3>
                <p>
                  1. Click the <strong>"📤 Upload Document"</strong> button<br/>
                  2. Click "Choose File" to select a document from your computer<br/>
                  3. (Optional) Enter a custom name for the document<br/>
                  4. (Optional) Add a description to help you find it later<br/>
                  5. Select a folder to upload to, or leave it in the root folder<br/>
                  6. Click "Upload" to save your document
                </p>
              </div>
              
              <div className="walkthrough-step">
                <h3>Step 3: Navigate Your Documents</h3>
                <p>
                  • Click on any folder to open it and see its contents<br/>
                  • Use the breadcrumb trail at the top to navigate back to previous folders<br/>
                  • Click the folder name in the breadcrumb to jump to that folder
                </p>
              </div>
              
              <div className="walkthrough-step">
                <h3>Step 4: Manage Your Documents</h3>
                <p>
                  • Click the <strong>✏️</strong> icon to edit a document or folder name<br/>
                  • Click the <strong>⬇️</strong> icon to download a document<br/>
                  • Click the <strong>🗑️</strong> icon to delete a document or folder<br/>
                  • All documents are securely stored in Google Cloud Storage
                </p>
              </div>
              
              <div className="walkthrough-step">
                <h3>💡 Tips</h3>
                <p>
                  • Create folders to organize documents by year, category, or purpose<br/>
                  • Add descriptions to documents to make them easier to search<br/>
                  • You earn points for creating folders and uploading documents!
                </p>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowWalkthrough(false)} className="btn-primary">
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (hideSidebar) {
    return content;
  }

  return (
    <div className="sidebar-layout" style={{ display: 'flex', height: 'calc(100vh - 60px)', marginTop: '60px' }}>
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <section className="nav-section">
            <h3>Dashboard</h3>
            <button 
              className="nav-btn" 
              onClick={() => navigate('/app')}
            >
              Home
            </button>
          </section>

          <section className="nav-section">
            <h3>Document Vault</h3>
            <button 
              className="nav-btn active" 
            >
              📁 My Documents
            </button>
          </section>
        </nav>
      </aside>
      <main className="main-content">
        {content}
      </main>
    </div>
  );
};

export default DocumentsPage;


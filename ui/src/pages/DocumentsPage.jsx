import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import DocumentsService from '../services/documents.service';
import ConfirmDialog from '../components/ConfirmDialog';
import AccountSwitcher from '../components/AccountSwitcher';
import './DocumentsPage.css';
import '../components/SidebarLayout.css';

const DocumentsPage = ({ hideSidebar = false }) => {
  const { currentUser, viewingUserId } = useAuth();
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([{ id: null, name: 'Root' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Form states
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  
  // Walkthrough
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    loadFolderContents(currentFolderId);
  }, [currentFolderId, viewingUserId]);

  const loadFolderContents = async (folderId) => {
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
    } catch (err) {
      setError('Failed to load folder contents');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = async (folder) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index) => {
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
    } catch (err) {
      alert('Failed to create folder: ' + (err.response?.data?.detail || err.message));
    }
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
    } catch (err) {
      alert('Failed to upload document: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEditItem = (item, isFolder) => {
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
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteFolder = (folder) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete "${folder.name}" and all its contents?`,
      onConfirm: async () => {
        try {
          await DocumentsService.deleteFolder(folder.id);
          loadFolderContents(currentFolderId);
        } catch (err) {
          alert('Failed to delete folder: ' + (err.response?.data?.detail || err.message));
        }
      }
    });
  };

  const handleDeleteDocument = (document) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document',
      message: `Are you sure you want to delete "${document.name}"?`,
      onConfirm: async () => {
        try {
          await DocumentsService.deleteDocument(document.id);
          loadFolderContents(currentFolderId);
        } catch (err) {
          alert('Failed to delete document: ' + (err.response?.data?.detail || err.message));
        }
      }
    });
  };

  const handleDownloadDocument = async (document) => {
    try {
      await DocumentsService.downloadDocument(document.id, document.name);
    } catch (err) {
      alert('Failed to download document: ' + (err.response?.data?.detail || err.message));
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const location = useLocation();
  const navigate = useNavigate();

  const content = (
    <div className="documents-page">
          <div className="documents-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
              <h1 style={{ margin: 0 }}>📁 Documents</h1>
              <AccountSwitcher compact={true} />
            </div>
            <div className="documents-actions">
              <button onClick={() => setShowWalkthrough(true)} className="btn-secondary" title="Show Tutorial">
                ❓ Tutorial
              </button>
              <button onClick={() => setShowNewFolderModal(true)} className="btn-primary">
                + New Folder
              </button>
              <button onClick={() => setShowUploadModal(true)} className="btn-primary">
                📤 Upload Document
              </button>
            </div>
          </div>

      {/* Breadcrumb navigation */}
      <div className="breadcrumb">
        {folderPath.map((folder, index) => (
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
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <div className="documents-content">
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
                  {folders.map((folder) => (
                    <tr key={folder.id}>
                      <td>
                        <button 
                          onClick={() => handleFolderClick(folder)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#007bff', 
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
                  {documents.map((doc) => (
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Folder</h2>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Upload Document</h2>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="form-input"
            />
            <input
              type="text"
              placeholder="Document name (optional)"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="form-input"
            />
            <textarea
              placeholder="Description (optional)"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              className="form-input"
              rows="3"
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit {editItem.isFolder ? 'Folder' : 'Document'}</h2>
            <input
              type="text"
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="form-input"
            />
            {!editItem.isFolder && (
              <textarea
                placeholder="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="form-input"
                rows="3"
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
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />

      {/* Walkthrough Modal */}
      {showWalkthrough && (
        <div className="modal-overlay" onClick={() => setShowWalkthrough(false)}>
          <div className="modal-content walkthrough-modal" onClick={(e) => e.stopPropagation()}>
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
              onClick={() => navigate('/')}
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


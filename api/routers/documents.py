from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
import auth
import database
from schemas_documents import (
    DocumentFolderCreate, DocumentFolderUpdate, DocumentFolderOut,
    DocumentCreate, DocumentUpdate, DocumentOut
)
from utils import gcs_storage
from utils.permission_dependencies import get_accessible_user_ids
from utils.subscription import get_user_limits
from utils.permissions import check_permission
import logging
import io
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    responses={404: {"description": "Not found"}},
)

# --- FOLDER ENDPOINTS ---

@router.post("/folders", response_model=DocumentFolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder: DocumentFolderCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Create a new document folder.
    """
    # Validate parent folder if specified
    if folder.parent_folder_id:
        parent = db.query(models.DocumentFolder).filter(
            models.DocumentFolder.id == folder.parent_folder_id,
            models.DocumentFolder.owner_id == current_user.id
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent folder not found"
            )
    
    # Create the folder
    db_folder = models.DocumentFolder(
        owner_id=current_user.id,
        name=folder.name,
        parent_folder_id=folder.parent_folder_id
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    
    logger.info(f"Created folder {db_folder.id} for user {current_user.id}")
    return db_folder


@router.get("/folders", response_model=List[DocumentFolderOut])
def list_folders(
    parent_folder_id: Optional[int] = None,
    viewing_user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    List all folders the current user can access (own or authorized).
    If parent_folder_id is specified, only return subfolders of that folder.
    If viewing_user_id is specified, only return folders for that user (must have access).
    If viewing_user_id is None, only return folders owned by the current user.
    """
    if viewing_user_id is None:
        # When viewing own account, only show own folders
        accessible_user_ids = [current_user.id]
    else:
        # Check if user has access to viewing_user_id
        accessible_user_ids = get_accessible_user_ids(db, current_user.id, "documents")
        if viewing_user_id not in accessible_user_ids:
            raise HTTPException(status_code=403, detail="You do not have access to view this user's documents")
        accessible_user_ids = [viewing_user_id]
    
    query = db.query(models.DocumentFolder).filter(
        models.DocumentFolder.owner_id.in_(accessible_user_ids)
    )
    
    if parent_folder_id is not None:
        query = query.filter(models.DocumentFolder.parent_folder_id == parent_folder_id)
    else:
        # If no parent specified, return root folders (parent_folder_id is None)
        query = query.filter(models.DocumentFolder.parent_folder_id.is_(None))
    
    folders = query.order_by(models.DocumentFolder.name).all()
    
    # Add owner_email to each folder
    result = []
    for folder in folders:
        owner = db.query(models.User).filter(models.User.id == folder.owner_id).first()
        folder_dict = {
            "id": folder.id,
            "name": folder.name,
            "parent_folder_id": folder.parent_folder_id,
            "owner_id": folder.owner_id,
            "owner_email": owner.email if owner else None,
            "created_at": folder.created_at,
            "updated_at": folder.updated_at,
        }
        result.append(folder_dict)
    return result


@router.get("/folders/{folder_id}", response_model=DocumentFolderOut)
def get_folder(
    folder_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Get a specific folder by ID (requires view permission).
    """
    folder = db.query(models.DocumentFolder).filter(
        models.DocumentFolder.id == folder_id
    ).first()
    
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    
    # Check view permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=folder.owner_id,
        permission_type="documents",
        required_permission="view"
    )
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this folder"
        )
    
    return folder


@router.put("/folders/{folder_id}", response_model=DocumentFolderOut)
def update_folder(
    folder_id: int,
    folder_update: DocumentFolderUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Update a folder's name or parent folder.
    """
    folder = db.query(models.DocumentFolder).filter(
        models.DocumentFolder.id == folder_id,
        models.DocumentFolder.owner_id == current_user.id
    ).first()
    
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    
    # Validate parent folder if being changed
    if folder_update.parent_folder_id is not None:
        if folder_update.parent_folder_id == folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A folder cannot be its own parent"
            )
        parent = db.query(models.DocumentFolder).filter(
            models.DocumentFolder.id == folder_update.parent_folder_id,
            models.DocumentFolder.owner_id == current_user.id
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent folder not found"
            )
    
    # Update fields
    if folder_update.name is not None:
        folder.name = folder_update.name
    if folder_update.parent_folder_id is not None:
        folder.parent_folder_id = folder_update.parent_folder_id
    
    db.commit()
    db.refresh(folder)
    
    logger.info(f"Updated folder {folder_id} for user {current_user.id}")
    return folder


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Delete a folder and all its contents (subfolders and documents) - requires edit permission.
    """
    folder = db.query(models.DocumentFolder).filter(
        models.DocumentFolder.id == folder_id
    ).first()
    
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=folder.owner_id,
        permission_type="documents",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this folder"
        )
    
    # Delete all documents in this folder from GCS
    documents = db.query(models.Document).filter(
        models.Document.folder_id == folder_id
    ).all()
    
    for doc in documents:
        try:
            gcs_storage.delete_file(doc.gcs_path)
        except Exception as e:
            logger.error(f"Failed to delete document {doc.id} from GCS: {str(e)}")
    
    # Delete the folder (cascade will handle subfolders and documents in DB)
    db.delete(folder)
    db.commit()
    
    logger.info(f"Deleted folder {folder_id} for user {current_user.id}")
    return None


# --- DOCUMENT ENDPOINTS ---

@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    folder_id: Optional[int] = Form(None),
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Upload a new document to GCS and create a database record.
    """
    limits = get_user_limits(db, current_user)
    if limits["is_limited"] and limits["max_documents"] is not None:
        existing_count = db.query(models.Document).filter(
            models.Document.owner_id == current_user.id
        ).count()
        if existing_count >= limits["max_documents"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Free plan supports up to {limits['max_documents']} documents."
            )

    # Validate folder if specified
    if folder_id:
        folder = db.query(models.DocumentFolder).filter(
            models.DocumentFolder.id == folder_id,
            models.DocumentFolder.owner_id == current_user.id
        ).first()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )
    
    # Use provided name or original filename
    doc_name = name if name else file.filename
    
    # Generate GCS path: user_id/folder_id/timestamp_filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    folder_path = f"{folder_id}" if folder_id else "root"
    gcs_path = f"user_{current_user.id}/{folder_path}/{timestamp}_{file.filename}"
    
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Upload to GCS
        gcs_storage.upload_file(
            io.BytesIO(file_content),
            gcs_path,
            file.content_type
        )
        
        # Create database record
        db_document = models.Document(
            owner_id=current_user.id,
            folder_id=folder_id,
            name=doc_name,
            description=description,
            file_type=file.content_type,
            file_size=file_size,
            gcs_path=gcs_path
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        logger.info(f"Uploaded document {db_document.id} for user {current_user.id}")
        return db_document
        
    except Exception as e:
        logger.error(f"Failed to upload document: {str(e)}")
        # Try to clean up GCS if DB insert failed
        try:
            gcs_storage.delete_file(gcs_path)
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.get("/", response_model=List[DocumentOut])
def list_documents(
    folder_id: Optional[int] = None,
    viewing_user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    List all documents the current user can access (own or authorized).
    If folder_id is specified, only return documents in that folder.
    If viewing_user_id is specified, only return documents for that user (must have access).
    If viewing_user_id is None, only return documents owned by the current user.
    """
    if viewing_user_id is None:
        # When viewing own account, only show own documents
        accessible_user_ids = [current_user.id]
    else:
        # Check if user has access to viewing_user_id
        accessible_user_ids = get_accessible_user_ids(db, current_user.id, "documents")
        if viewing_user_id not in accessible_user_ids:
            raise HTTPException(status_code=403, detail="You do not have access to view this user's documents")
        accessible_user_ids = [viewing_user_id]
    query = db.query(models.Document).filter(
        models.Document.owner_id.in_(accessible_user_ids)
    )
    
    if folder_id is not None:
        query = query.filter(models.Document.folder_id == folder_id)
    else:
        # If no folder specified, return root documents (folder_id is None)
        query = query.filter(models.Document.folder_id.is_(None))
    
    documents = query.order_by(models.Document.created_at.desc()).all()
    
    # Add owner_email to each document
    result = []
    for doc in documents:
        owner = db.query(models.User).filter(models.User.id == doc.owner_id).first()
        doc_dict = {
            "id": doc.id,
            "name": doc.name,
            "description": doc.description,
            "folder_id": doc.folder_id,
            "owner_id": doc.owner_id,
            "owner_email": owner.email if owner else None,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
            "gcs_path": doc.gcs_path,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
        }
        result.append(doc_dict)
    return result


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Get a specific document by ID (requires view permission).
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check view permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=document.owner_id,
        permission_type="documents",
        required_permission="view"
    )
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this document"
        )
    
    return document


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Download a document from GCS (requires view permission).
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check view permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=document.owner_id,
        permission_type="documents",
        required_permission="view"
    )
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to download this document"
        )
    
    try:
        # Download from GCS
        file_content = gcs_storage.download_file(document.gcs_path)
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=document.file_type or "application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{document.name}"'
            }
        )
    except Exception as e:
        logger.error(f"Failed to download document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download document: {str(e)}"
        )


@router.get("/{document_id}/url")
def get_document_url(
    document_id: int,
    expiration_minutes: int = 60,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Get a signed URL for temporary access to a document (requires view permission).
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check view permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=document.owner_id,
        permission_type="documents",
        required_permission="view"
    )
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this document"
        )
    
    try:
        url = gcs_storage.generate_signed_url(document.gcs_path, expiration_minutes)
        return {"url": url, "expires_in_minutes": expiration_minutes}
    except Exception as e:
        logger.error(f"Failed to generate URL for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate document URL: {str(e)}"
        )


@router.put("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Update a document's metadata (name, description, folder) - requires edit permission.
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=document.owner_id,
        permission_type="documents",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this document"
        )
    
    # Validate folder if being changed
    if document_update.folder_id is not None:
        folder = db.query(models.DocumentFolder).filter(
            models.DocumentFolder.id == document_update.folder_id,
            models.DocumentFolder.owner_id == current_user.id
        ).first()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )
    
    # Update fields
    if document_update.name is not None:
        document.name = document_update.name
    if document_update.description is not None:
        document.description = document_update.description
    if document_update.folder_id is not None:
        document.folder_id = document_update.folder_id
    
    db.commit()
    db.refresh(document)
    
    logger.info(f"Updated document {document_id} for user {current_user.id}")
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Delete a document from both the database and GCS (requires edit permission).
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=document.owner_id,
        permission_type="documents",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this document"
        )
    
    # Delete from GCS
    try:
        gcs_storage.delete_file(document.gcs_path)
    except Exception as e:
        logger.error(f"Failed to delete document from GCS: {str(e)}")
        # Continue with DB deletion even if GCS deletion fails
    
    # Delete from database
    db.delete(document)
    db.commit()
    
    logger.info(f"Deleted document {document_id} for user {current_user.id}")
    return None


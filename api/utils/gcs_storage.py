"""
Google Cloud Storage utility functions for document storage.
This module provides functions to upload, download, and delete files from GCS.
"""
import os
import logging
from typing import Optional, BinaryIO
from google.cloud import storage
from google.cloud.exceptions import NotFound
from config import settings

logger = logging.getLogger(__name__)

# GCS Configuration
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "finmodel-documents")
GCS_PROJECT_ID = os.getenv("GCS_PROJECT_ID")

def get_storage_client() -> storage.Client:
    """
    Get a Google Cloud Storage client.
    Uses application default credentials or service account key.
    """
    try:
        if GCS_PROJECT_ID:
            client = storage.Client(project=GCS_PROJECT_ID)
        else:
            client = storage.Client()
        return client
    except Exception as e:
        logger.error(f"Failed to create GCS client: {str(e)}")
        raise


def upload_file(
    file_content: BinaryIO,
    destination_path: str,
    content_type: Optional[str] = None
) -> str:
    """
    Upload a file to Google Cloud Storage.
    
    Args:
        file_content: File-like object containing the file data
        destination_path: Path in the bucket where the file will be stored
        content_type: MIME type of the file
    
    Returns:
        The GCS path of the uploaded file
    """
    try:
        client = get_storage_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(destination_path)
        
        # Upload the file
        if content_type:
            blob.upload_from_file(file_content, content_type=content_type)
        else:
            blob.upload_from_file(file_content)
        
        logger.info(f"File uploaded to GCS: {destination_path}")
        return destination_path
    except Exception as e:
        logger.error(f"Failed to upload file to GCS: {str(e)}")
        raise


def download_file(gcs_path: str) -> bytes:
    """
    Download a file from Google Cloud Storage.
    
    Args:
        gcs_path: Path of the file in the bucket
    
    Returns:
        File content as bytes
    """
    try:
        client = get_storage_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(gcs_path)
        
        if not blob.exists():
            raise NotFound(f"File not found in GCS: {gcs_path}")
        
        content = blob.download_as_bytes()
        logger.info(f"File downloaded from GCS: {gcs_path}")
        return content
    except Exception as e:
        logger.error(f"Failed to download file from GCS: {str(e)}")
        raise


def delete_file(gcs_path: str) -> bool:
    """
    Delete a file from Google Cloud Storage.
    
    Args:
        gcs_path: Path of the file in the bucket
    
    Returns:
        True if successful, False otherwise
    """
    try:
        client = get_storage_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(gcs_path)
        
        if blob.exists():
            blob.delete()
            logger.info(f"File deleted from GCS: {gcs_path}")
            return True
        else:
            logger.warning(f"File not found in GCS, cannot delete: {gcs_path}")
            return False
    except Exception as e:
        logger.error(f"Failed to delete file from GCS: {str(e)}")
        return False


def generate_signed_url(gcs_path: str, expiration_minutes: int = 60) -> str:
    """
    Generate a signed URL for temporary access to a file.
    
    Args:
        gcs_path: Path of the file in the bucket
        expiration_minutes: How long the URL should be valid (default 60 minutes)
    
    Returns:
        Signed URL string
    """
    try:
        from datetime import timedelta
        
        client = get_storage_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(gcs_path)
        
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="GET"
        )
        
        logger.info(f"Generated signed URL for: {gcs_path}")
        return url
    except Exception as e:
        logger.error(f"Failed to generate signed URL: {str(e)}")
        raise


def get_file_metadata(gcs_path: str) -> dict:
    """
    Get metadata for a file in GCS.
    
    Args:
        gcs_path: Path of the file in the bucket
    
    Returns:
        Dictionary containing file metadata
    """
    try:
        client = get_storage_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(gcs_path)
        
        if not blob.exists():
            raise NotFound(f"File not found in GCS: {gcs_path}")
        
        blob.reload()
        
        return {
            "name": blob.name,
            "size": blob.size,
            "content_type": blob.content_type,
            "created": blob.time_created,
            "updated": blob.updated,
        }
    except Exception as e:
        logger.error(f"Failed to get file metadata from GCS: {str(e)}")
        raise


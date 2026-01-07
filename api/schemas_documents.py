from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

# --- DOCUMENT FOLDER SCHEMAS ---

class DocumentFolderBase(BaseModel):
    name: str
    parent_folder_id: Optional[int] = None

class DocumentFolderCreate(DocumentFolderBase):
    pass

class DocumentFolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_folder_id: Optional[int] = None

class DocumentFolderOut(DocumentFolderBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- DOCUMENT SCHEMAS ---

class DocumentBase(BaseModel):
    name: str
    description: Optional[str] = None
    folder_id: Optional[int] = None

class DocumentCreate(DocumentBase):
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    gcs_path: str

class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    folder_id: Optional[int] = None

class DocumentOut(DocumentBase):
    id: int
    owner_id: int
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    gcs_path: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


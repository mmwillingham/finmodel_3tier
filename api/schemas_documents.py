from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


FieldType = Literal["text", "number", "date", "select", "multi-select", "boolean", "email", "phone", "url", "textarea"]


class DocumentFieldConfig(BaseModel):
    id: str
    label: str
    field_type: FieldType
    required: bool = False
    placeholder: Optional[str] = None
    options: list[str] = Field(default_factory=list)
    is_sensitive: bool = False
    hidden: bool = False

    model_config = ConfigDict(extra="ignore")


class DocumentTypeDefinitionBase(BaseModel):
    category: str
    doc_type: str
    description: Optional[str] = None
    fields_config: list[DocumentFieldConfig] = Field(default_factory=list)
    is_active: bool = True


class DocumentTypeDefinitionCreate(DocumentTypeDefinitionBase):
    pass


class DocumentTypeDefinitionUpdate(BaseModel):
    category: Optional[str] = None
    doc_type: Optional[str] = None
    description: Optional[str] = None
    fields_config: Optional[list[DocumentFieldConfig]] = None
    is_active: Optional[bool] = None


class DocumentTypeDefinitionOut(DocumentTypeDefinitionBase):
    id: int
    owner_id: Optional[int] = None
    is_system_default: bool
    template_key: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LoadDefaultsResponse(BaseModel):
    created: int
    message: str


class DocumentEntryBase(BaseModel):
    definition_id: Optional[int] = None
    category: str
    doc_type: str
    title: str
    description: Optional[str] = None
    notes: Optional[str] = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    folder_label: Optional[str] = None


class DocumentEntryCreate(DocumentEntryBase):
    pass


class DocumentEntryUpdate(BaseModel):
    definition_id: Optional[int] = None
    category: Optional[str] = None
    doc_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None
    folder_label: Optional[str] = None


class DocumentEntryOut(DocumentEntryBase):
    id: int
    owner_id: int
    owner_email: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    storage_path: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


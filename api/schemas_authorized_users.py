from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, Literal
from datetime import datetime

PermissionType = Literal["view", "edit", None]

# --- AUTHORIZED USER SCHEMAS ---

class AuthorizedUserBase(BaseModel):
    authorized_user_email: str
    accounts_permission: Optional[PermissionType] = None
    items_permission: Optional[PermissionType] = None
    projections_permission: Optional[PermissionType] = None
    charts_permission: Optional[PermissionType] = None
    documents_permission: Optional[PermissionType] = None

    @field_validator('accounts_permission', 'items_permission', 'projections_permission', 'charts_permission', 'documents_permission')
    @classmethod
    def validate_permission(cls, v):
        if v is not None and v not in ["view", "edit"]:
            raise ValueError('Permission must be "view", "edit", or null')
        return v

class AuthorizedUserCreate(AuthorizedUserBase):
    pass

class AuthorizedUserUpdate(BaseModel):
    accounts_permission: Optional[PermissionType] = None
    items_permission: Optional[PermissionType] = None
    projections_permission: Optional[PermissionType] = None
    charts_permission: Optional[PermissionType] = None
    documents_permission: Optional[PermissionType] = None

    @field_validator('accounts_permission', 'items_permission', 'projections_permission', 'charts_permission', 'documents_permission')
    @classmethod
    def validate_permission(cls, v):
        if v is not None and v not in ["view", "edit"]:
            raise ValueError('Permission must be "view", "edit", or null')
        return v

class AuthorizedUserOut(AuthorizedUserBase):
    id: int
    primary_user_id: int
    authorized_user_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Extended output with user details
class AuthorizedUserDetailOut(AuthorizedUserOut):
    authorized_user_email: str  # Already in base, but explicit
    model_config = ConfigDict(from_attributes=True)


from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, Literal
from datetime import datetime

PermissionType = Literal["view", "edit", None]

# --- AUTHORIZED USER SCHEMAS ---

class AuthorizedUserBase(BaseModel):
    authorized_user_email: str
    financial_data_permission: Optional[PermissionType] = None  # Applies to Accounts, Items, Projections, Charts
    document_vault_permission: Optional[PermissionType] = None  # Renamed from Documents

    @field_validator('financial_data_permission', 'document_vault_permission')
    @classmethod
    def validate_permission(cls, v):
        if v is not None and v not in ["view", "edit"]:
            raise ValueError('Permission must be "view", "edit", or null')
        return v

class AuthorizedUserCreate(AuthorizedUserBase):
    temporary_password: Optional[str] = None
    """Optional temporary password. If provided, the user account will be created immediately.
    The user will be required to change this password on first login."""

class AuthorizedUserUpdate(BaseModel):
    financial_data_permission: Optional[PermissionType] = None
    document_vault_permission: Optional[PermissionType] = None

    @field_validator('financial_data_permission', 'document_vault_permission')
    @classmethod
    def validate_permission(cls, v):
        if v is not None and v not in ["view", "edit"]:
            raise ValueError('Permission must be "view", "edit", or null')
        return v

class AuthorizedUserOut(AuthorizedUserBase):
    id: int
    primary_user_id: int
    authorized_user_id: Optional[int] = None  # Can be None if user hasn't registered yet
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Extended output with user details
class AuthorizedUserDetailOut(AuthorizedUserOut):
    authorized_user_email: str  # Already in base, but explicit
    model_config = ConfigDict(from_attributes=True)


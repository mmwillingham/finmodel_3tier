"""
Permission checking utilities for authorized users.
"""
from sqlalchemy.orm import Session
from typing import Optional, Literal
import models

PermissionType = Literal["view", "edit"]

def check_permission(
    db: Session,
    current_user_id: int,
    primary_user_id: int,
    permission_type: str,  # "accounts", "items", "projections", "charts", "documents", "financial_data", "document_vault"
    required_permission: PermissionType = "view"
) -> bool:
    """
    Check if the current user has the required permission to access a resource owned by primary_user.
    
    Args:
        db: Database session
        current_user_id: ID of the user making the request
        primary_user_id: ID of the resource owner
        permission_type: Type of permission to check 
            - Legacy: "accounts", "items", "projections", "charts" (all map to "financial_data")
            - New: "financial_data", "document_vault"
            - Legacy: "documents" (maps to "document_vault")
        required_permission: Required permission level ("view" or "edit")
    
    Returns:
        True if user has required permission, False otherwise
    """
    # User always has full access to their own resources
    if current_user_id == primary_user_id:
        return True
    
    # Check if user is authorized
    authorized_user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.primary_user_id == primary_user_id,
        models.AuthorizedUser.authorized_user_id == current_user_id
    ).first()
    
    if not authorized_user:
        return False
    
    # Map legacy permission types to new structure
    if permission_type in ["accounts", "items", "projections", "charts"]:
        permission_type = "financial_data"
    elif permission_type == "documents":
        permission_type = "document_vault"
    
    # Get the permission for this resource type
    permission_field = f"{permission_type}_permission"
    user_permission = getattr(authorized_user, permission_field, None)
    
    if user_permission is None:
        return False
    
    # Check permission level
    if required_permission == "view":
        # View permission allows both view and edit
        return user_permission in ["view", "edit"]
    elif required_permission == "edit":
        # Edit permission requires explicit "edit"
        return user_permission == "edit"
    
    return False


def get_authorized_users_for_primary(
    db: Session,
    primary_user_id: int
) -> list[models.AuthorizedUser]:
    """
    Get all authorized users for a primary user.
    
    Args:
        db: Database session
        primary_user_id: ID of the primary user
    
    Returns:
        List of AuthorizedUser objects
    """
    return db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.primary_user_id == primary_user_id
    ).all()


def get_primary_users_for_authorized(
    db: Session,
    authorized_user_id: int
) -> list[models.AuthorizedUser]:
    """
    Get all primary users that have granted access to an authorized user.
    
    Args:
        db: Database session
        authorized_user_id: ID of the authorized user
    
    Returns:
        List of AuthorizedUser objects (where authorized_user_id is the user)
    """
    return db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.authorized_user_id == authorized_user_id
    ).all()


def has_permission_for_resource_type(
    db: Session,
    current_user_id: int,
    primary_user_id: int,
    permission_type: str
) -> Optional[PermissionType]:
    """
    Get the permission level for a specific resource type.
    
    Args:
        db: Database session
        current_user_id: ID of the user making the request
        primary_user_id: ID of the resource owner
        permission_type: Type of permission 
            - Legacy: "accounts", "items", "projections", "charts" (all map to "financial_data")
            - New: "financial_data", "document_vault"
            - Legacy: "documents" (maps to "document_vault")
    
    Returns:
        Permission level ("view", "edit") or None if no permission
    """
    # User always has edit permission to their own resources
    if current_user_id == primary_user_id:
        return "edit"
    
    # Check if user is authorized
    authorized_user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.primary_user_id == primary_user_id,
        models.AuthorizedUser.authorized_user_id == current_user_id
    ).first()
    
    if not authorized_user:
        return None
    
    # Map legacy permission types to new structure
    if permission_type in ["accounts", "items", "projections", "charts"]:
        permission_type = "financial_data"
    elif permission_type == "documents":
        permission_type = "document_vault"
    
    # Get the permission for this resource type
    permission_field = f"{permission_type}_permission"
    return getattr(authorized_user, permission_field, None)


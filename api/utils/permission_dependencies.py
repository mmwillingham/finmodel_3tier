"""
FastAPI dependencies for checking permissions.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import auth
import database
from utils.permissions import check_permission


def require_permission(
    resource_owner_id: int,
    permission_type: str,  # "accounts", "items", "projections", "charts", "documents"
    required_permission: str = "view"  # "view" or "edit"
):
    """
    Dependency factory that creates a permission checker for a specific resource.
    
    Usage:
        @router.get("/{account_id}")
        def get_account(
            account_id: int,
            db: Session = Depends(database.get_db),
            current_user: schemas.UserOut = Depends(auth.get_current_user),
            _: None = Depends(require_permission(resource_owner_id, "accounts", "view"))
        ):
    """
    async def check(
        current_user: schemas.UserOut = Depends(auth.get_current_user),
        db: Session = Depends(database.get_db)
    ):
        has_permission = check_permission(
            db=db,
            current_user_id=current_user.id,
            primary_user_id=resource_owner_id,
            permission_type=permission_type,
            required_permission=required_permission
        )
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have {required_permission} permission for this resource"
            )
        return None
    
    return check


def get_accessible_user_ids(
    db: Session,
    current_user_id: int,
    permission_type: str
) -> List[int]:
    """
    Get a list of user IDs whose resources the current user can access.
    Includes the current user (for their own resources) plus any primary users
    that have granted access with the specified permission type.
    
    Args:
        db: Database session
        current_user_id: ID of the current user
        permission_type: Type of permission ("accounts", "items", etc.)
    
    Returns:
        List of user IDs (includes current_user_id + any primary user IDs with access)
    """
    user_ids = [current_user_id]  # Always include own resources
    
    # Find all primary users that have granted access to this user
    authorized_access = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.authorized_user_id == current_user_id
    ).all()
    
    for access in authorized_access:
        # Check if this permission type is granted
        permission_field = f"{permission_type}_permission"
        permission = getattr(access, permission_field)
        
        # If permission is "view" or "edit", add primary user to list
        if permission in ["view", "edit"]:
            user_ids.append(access.primary_user_id)
    
    return user_ids


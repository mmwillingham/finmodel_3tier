from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import auth
import database
from schemas_authorized_users import (
    AuthorizedUserCreate, AuthorizedUserUpdate, AuthorizedUserOut
)
from utils.permissions import get_authorized_users_for_primary
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/authorized-users",
    tags=["authorized-users"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=AuthorizedUserOut, status_code=status.HTTP_201_CREATED)
def create_authorized_user(
    authorized_user: AuthorizedUserCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Create a new authorized user entry.
    The current user (primary_user) grants access to another user (authorized_user).
    """
    # Find the authorized user by email
    target_user = db.query(models.User).filter(
        models.User.email == authorized_user.authorized_user_email.lower()
    ).first()
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {authorized_user.authorized_user_email} not found. They must register first."
        )
    
    # Cannot authorize yourself
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot authorize yourself"
        )
    
    # Check if this authorization already exists
    existing = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.primary_user_id == current_user.id,
        models.AuthorizedUser.authorized_user_id == target_user.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user is already authorized"
        )
    
    # Create the authorized user entry
    db_authorized_user = models.AuthorizedUser(
        primary_user_id=current_user.id,
        authorized_user_id=target_user.id,
        authorized_user_email=authorized_user.authorized_user_email.lower(),
        accounts_permission=authorized_user.accounts_permission,
        items_permission=authorized_user.items_permission,
        projections_permission=authorized_user.projections_permission,
        charts_permission=authorized_user.charts_permission,
        documents_permission=authorized_user.documents_permission
    )
    
    db.add(db_authorized_user)
    db.commit()
    db.refresh(db_authorized_user)
    
    logger.info(f"Created authorized user {target_user.id} for primary user {current_user.id}")
    return db_authorized_user


@router.get("/", response_model=List[AuthorizedUserOut])
def list_authorized_users(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    List all users authorized by the current user (primary user).
    """
    authorized_users = get_authorized_users_for_primary(db, current_user.id)
    return authorized_users


@router.get("/received", response_model=List[AuthorizedUserOut])
def list_authorized_access_received(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    List all primary users that have granted access to the current user.
    """
    authorized_access = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.authorized_user_id == current_user.id
    ).all()
    return authorized_access


@router.get("/{authorized_user_id}", response_model=AuthorizedUserOut)
def get_authorized_user(
    authorized_user_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Get a specific authorized user entry by ID.
    """
    authorized_user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.id == authorized_user_id,
        models.AuthorizedUser.primary_user_id == current_user.id
    ).first()
    
    if not authorized_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authorized user not found"
        )
    
    return authorized_user


@router.put("/{authorized_user_id}", response_model=AuthorizedUserOut)
def update_authorized_user(
    authorized_user_id: int,
    authorized_user_update: AuthorizedUserUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Update permissions for an authorized user.
    """
    authorized_user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.id == authorized_user_id,
        models.AuthorizedUser.primary_user_id == current_user.id
    ).first()
    
    if not authorized_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authorized user not found"
        )
    
    # Update permissions (only if provided)
    if authorized_user_update.accounts_permission is not None:
        authorized_user.accounts_permission = authorized_user_update.accounts_permission
    if authorized_user_update.items_permission is not None:
        authorized_user.items_permission = authorized_user_update.items_permission
    if authorized_user_update.projections_permission is not None:
        authorized_user.projections_permission = authorized_user_update.projections_permission
    if authorized_user_update.charts_permission is not None:
        authorized_user.charts_permission = authorized_user_update.charts_permission
    if authorized_user_update.documents_permission is not None:
        authorized_user.documents_permission = authorized_user_update.documents_permission
    
    db.commit()
    db.refresh(authorized_user)
    
    logger.info(f"Updated authorized user {authorized_user_id} for primary user {current_user.id}")
    return authorized_user


@router.delete("/{authorized_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_authorized_user(
    authorized_user_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Remove authorization for a user.
    """
    authorized_user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.id == authorized_user_id,
        models.AuthorizedUser.primary_user_id == current_user.id
    ).first()
    
    if not authorized_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authorized user not found"
        )
    
    db.delete(authorized_user)
    db.commit()
    
    logger.info(f"Deleted authorized user {authorized_user_id} for primary user {current_user.id}")
    return None


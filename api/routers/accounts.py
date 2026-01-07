from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
import models
import schemas
import auth
import database
from utils.permission_dependencies import get_accessible_user_ids
from utils.permissions import check_permission
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/accounts",
    tags=["accounts"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.AccountOut])
def list_accounts(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List all accounts the current user can access (own or authorized)."""
    accessible_user_ids = get_accessible_user_ids(db, current_user.id, "accounts")
    accounts = db.query(models.Account).filter(
        models.Account.owner_id.in_(accessible_user_ids)
    ).order_by(models.Account.brokerage, models.Account.account_name).all()
    return accounts

@router.post("/", response_model=schemas.AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    account: schemas.AccountCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Create a new account."""
    db_account = models.Account(**account.model_dump(), owner_id=current_user.id)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

@router.get("/{account_id}", response_model=schemas.AccountOut)
def get_account(
    account_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Get a specific account by ID (requires view permission)."""
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Check permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=account.owner_id,
        permission_type="accounts",
        required_permission="view"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to view this account")
    
    return account

@router.put("/{account_id}", response_model=schemas.AccountOut)
def update_account(
    account_id: int,
    account_update: schemas.AccountUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Update an existing account (requires edit permission)."""
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=db_account.owner_id,
        permission_type="accounts",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this account")
    
    update_data = account_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_account, field, value)
    
    db.commit()
    db.refresh(db_account)
    return db_account

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Delete an account (requires edit permission). Will set account_id to NULL on linked assets."""
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=db_account.owner_id,
        permission_type="accounts",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this account")
    
    # Check if any assets are linked to this account
    linked_assets = db.query(models.Asset).filter(models.Asset.account_id == account_id).all()
    if linked_assets:
        # Set account_id to NULL for linked assets
        for asset in linked_assets:
            asset.account_id = None
    
    db.delete(db_account)
    db.commit()
    return None

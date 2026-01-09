from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
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
    viewing_user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List all accounts the current user can access (own or authorized).
    If viewing_user_id is provided, filter to that specific user's accounts (must be accessible)."""
    accessible_user_ids = get_accessible_user_ids(db, current_user.id, "accounts")
    
    # If viewing_user_id is specified, validate it's accessible and filter to it
    if viewing_user_id is not None:
        if viewing_user_id not in accessible_user_ids:
            raise HTTPException(status_code=403, detail="You do not have access to view this user's data")
        accessible_user_ids = [viewing_user_id]
    accounts = db.query(models.Account).filter(
        models.Account.owner_id.in_(accessible_user_ids)
    ).order_by(models.Account.brokerage, models.Account.account_name).all()
    
    # Add owner email to each account
    result = []
    for account in accounts:
        owner = db.query(models.User).filter(models.User.id == account.owner_id).first()
        account_dict = {
            "id": account.id,
            "brokerage": account.brokerage,
            "broker_name": account.broker_name,
            "broker_phone": account.broker_phone,
            "broker_email": account.broker_email,
            "account_name": account.account_name,
            "account_number": account.account_number,
            "is_retirement": account.is_retirement,
            "owner_id": account.owner_id,
            "owner_email": owner.email if owner else None,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
        }
        result.append(account_dict)
    
    return result

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
    
    # Return with owner email
    return {
        "id": db_account.id,
        "brokerage": db_account.brokerage,
        "broker_name": db_account.broker_name,
        "broker_phone": db_account.broker_phone,
        "broker_email": db_account.broker_email,
        "account_name": db_account.account_name,
        "account_number": db_account.account_number,
        "is_retirement": db_account.is_retirement,
        "owner_id": db_account.owner_id,
        "owner_email": current_user.email,
        "created_at": db_account.created_at,
        "updated_at": db_account.updated_at,
    }

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
    
    # Add owner email
    owner = db.query(models.User).filter(models.User.id == account.owner_id).first()
    return {
        "id": account.id,
        "brokerage": account.brokerage,
        "broker_name": account.broker_name,
        "broker_phone": account.broker_phone,
        "broker_email": account.broker_email,
        "account_name": account.account_name,
        "account_number": account.account_number,
        "is_retirement": account.is_retirement,
        "owner_id": account.owner_id,
        "owner_email": owner.email if owner else None,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }

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
    
    # Return with owner email
    owner = db.query(models.User).filter(models.User.id == db_account.owner_id).first()
    return {
        "id": db_account.id,
        "brokerage": db_account.brokerage,
        "broker_name": db_account.broker_name,
        "broker_phone": db_account.broker_phone,
        "broker_email": db_account.broker_email,
        "account_name": db_account.account_name,
        "account_number": db_account.account_number,
        "is_retirement": db_account.is_retirement,
        "owner_id": db_account.owner_id,
        "owner_email": owner.email if owner else None,
        "created_at": db_account.created_at,
        "updated_at": db_account.updated_at,
    }

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

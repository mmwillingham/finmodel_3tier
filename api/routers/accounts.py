from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
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
    If viewing_user_id is None, only show the current user's own accounts.
    If viewing_user_id is provided, filter to that specific user's accounts (must be accessible)."""
    logger.debug(f"list_accounts: User ID: {current_user.id}, viewing_user_id: {viewing_user_id}")
    
    # Default to only showing current user's accounts when viewingUserId is None
    if viewing_user_id is None:
        accessible_user_ids = [current_user.id]
    else:
        # When viewing a specific user, check if they're accessible
        accessible_user_ids = get_accessible_user_ids(db, current_user.id, "accounts")
        if viewing_user_id not in accessible_user_ids:
            raise HTTPException(status_code=403, detail="You do not have access to view this user's data")
        accessible_user_ids = [viewing_user_id]
    
    accounts = db.query(models.Account).options(
        joinedload(models.Account.brokerage_rel)
    ).filter(
        models.Account.owner_id.in_(accessible_user_ids)
    ).order_by(models.Account.brokerage_id, models.Account.account_name).all()
    
    # Add owner email and brokerage info to each account
    result = []
    for account in accounts:
        owner = db.query(models.User).filter(models.User.id == account.owner_id).first()
        
        # Get brokerage info from relationship or legacy fields
        if account.brokerage_rel:
            brokerage_name = account.brokerage_rel.name
            broker_name = account.brokerage_rel.broker_name
            broker_phone = account.brokerage_rel.broker_phone
            broker_email = account.brokerage_rel.broker_email
        else:
            # Fallback to legacy fields
            brokerage_name = account.brokerage or "Unknown"
            broker_name = account.broker_name
            broker_phone = account.broker_phone
            broker_email = account.broker_email
        
        account_dict = {
            "id": account.id,
            "brokerage_id": account.brokerage_id,
            "brokerage": brokerage_name,
            "broker_name": broker_name,
            "broker_phone": broker_phone,
            "broker_email": broker_email,
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
    """Create a new account. If brokerage_id is provided, use it. Otherwise, find or create brokerage from legacy fields."""
    brokerage_id = account.brokerage_id
    
    # If no brokerage_id provided, find or create brokerage from legacy fields
    if not brokerage_id:
        if not account.brokerage:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either brokerage_id or brokerage name must be provided"
            )
        
        # Find existing brokerage with same name
        existing_brokerage = db.query(models.Brokerage).filter(
            models.Brokerage.owner_id == current_user.id,
            models.Brokerage.name == account.brokerage
        ).first()
        
        if existing_brokerage:
            brokerage_id = existing_brokerage.id
        else:
            # Create new brokerage
            new_brokerage = models.Brokerage(
                owner_id=current_user.id,
                name=account.brokerage,
                broker_name=account.broker_name,
                broker_phone=account.broker_phone,
                broker_email=account.broker_email
            )
            db.add(new_brokerage)
            db.flush()  # Flush to get the ID without committing
            brokerage_id = new_brokerage.id
    
    # Create account with brokerage_id
    account_data = {
        "owner_id": current_user.id,
        "brokerage_id": brokerage_id,
        "account_name": account.account_name,
        "account_number": account.account_number,
        "is_retirement": account.is_retirement,
    }
    db_account = models.Account(**account_data)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    
    # Load brokerage relationship
    db_account = db.query(models.Account).options(
        joinedload(models.Account.brokerage_rel)
    ).filter(models.Account.id == db_account.id).first()
    
    # Get brokerage info
    if db_account.brokerage_rel:
        brokerage_name = db_account.brokerage_rel.name
        broker_name = db_account.brokerage_rel.broker_name
        broker_phone = db_account.brokerage_rel.broker_phone
        broker_email = db_account.brokerage_rel.broker_email
    else:
        brokerage_name = account.brokerage or "Unknown"
        broker_name = account.broker_name
        broker_phone = account.broker_phone
        broker_email = account.broker_email
    
    return {
        "id": db_account.id,
        "brokerage_id": db_account.brokerage_id,
        "brokerage": brokerage_name,
        "broker_name": broker_name,
        "broker_phone": broker_phone,
        "broker_email": broker_email,
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
    account = db.query(models.Account).options(
        joinedload(models.Account.brokerage_rel)
    ).filter(models.Account.id == account_id).first()
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
    
    # Get brokerage info from relationship or legacy fields
    if account.brokerage_rel:
        brokerage_name = account.brokerage_rel.name
        broker_name = account.brokerage_rel.broker_name
        broker_phone = account.brokerage_rel.broker_phone
        broker_email = account.brokerage_rel.broker_email
    else:
        brokerage_name = account.brokerage or "Unknown"
        broker_name = account.broker_name
        broker_phone = account.broker_phone
        broker_email = account.broker_email
    
    # Add owner email
    owner = db.query(models.User).filter(models.User.id == account.owner_id).first()
    return {
        "id": account.id,
        "brokerage_id": account.brokerage_id,
        "brokerage": brokerage_name,
        "broker_name": broker_name,
        "broker_phone": broker_phone,
        "broker_email": broker_email,
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
    db_account = db.query(models.Account).options(
        joinedload(models.Account.brokerage_rel)
    ).filter(models.Account.id == account_id).first()
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
    
    # Validate brokerage_id if provided
    if account_update.brokerage_id is not None:
        brokerage = db.query(models.Brokerage).filter(models.Brokerage.id == account_update.brokerage_id).first()
        if not brokerage:
            raise HTTPException(status_code=404, detail="Brokerage not found")
        # Check if user has access to this brokerage
        accessible_user_ids = get_accessible_user_ids(db, current_user.id, "accounts")
        if brokerage.owner_id not in accessible_user_ids:
            raise HTTPException(status_code=403, detail="You do not have access to this brokerage")
    
    update_data = account_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_account, field, value)
    
    db.commit()
    db.refresh(db_account)
    
    # Reload with brokerage relationship
    db_account = db.query(models.Account).options(
        joinedload(models.Account.brokerage_rel)
    ).filter(models.Account.id == account_id).first()
    
    # Get brokerage info
    if db_account.brokerage_rel:
        brokerage_name = db_account.brokerage_rel.name
        broker_name = db_account.brokerage_rel.broker_name
        broker_phone = db_account.brokerage_rel.broker_phone
        broker_email = db_account.brokerage_rel.broker_email
    else:
        brokerage_name = db_account.brokerage or "Unknown"
        broker_name = db_account.broker_name
        broker_phone = db_account.broker_phone
        broker_email = db_account.broker_email
    
    # Return with owner email
    owner = db.query(models.User).filter(models.User.id == db_account.owner_id).first()
    return {
        "id": db_account.id,
        "brokerage_id": db_account.brokerage_id,
        "brokerage": brokerage_name,
        "broker_name": broker_name,
        "broker_phone": broker_phone,
        "broker_email": broker_email,
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
    cascade: bool = False,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Delete an account (requires edit permission). 
    If cascade=True, will also delete all linked assets and liabilities.
    If cascade=False (default), will set account_id to NULL on linked assets/liabilities."""
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
    
    # Handle linked assets and liabilities
    linked_assets = db.query(models.Asset).filter(models.Asset.account_id == account_id).all()
    linked_liabilities = db.query(models.Liability).filter(models.Liability.account_id == account_id).all()
    
    if cascade:
        # Cascade delete: delete all linked assets and liabilities
        for asset in linked_assets:
            db.delete(asset)
        for liability in linked_liabilities:
            db.delete(liability)
    else:
        # Set account_id to NULL for linked assets/liabilities
        for asset in linked_assets:
            asset.account_id = None
        for liability in linked_liabilities:
            liability.account_id = None
    
    db.delete(db_account)
    db.commit()
    return None

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import auth
import database
from utils.permission_dependencies import get_accessible_user_ids


router = APIRouter(
    prefix="/brokerages",
    tags=["brokerages"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.BrokerageOut])
def list_brokerages(
    viewing_user_id: int | None = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List all brokerages the current user can access.
    If viewing_user_id is None, only show the current user's own brokerages.
    If viewing_user_id is provided, filter to that specific user's brokerages (must be accessible)."""
    
    # Default to only showing current user's brokerages when viewingUserId is None
    if viewing_user_id is None:
        accessible_user_ids = [current_user.id]
    else:
        # When viewing a specific user, check if they're accessible
        accessible_user_ids = get_accessible_user_ids(db, current_user.id, "accounts")
        if viewing_user_id not in accessible_user_ids:
            raise HTTPException(status_code=403, detail="You do not have access to view this user's data")
        accessible_user_ids = [viewing_user_id]
    
    brokerages = db.query(models.Brokerage).filter(
        models.Brokerage.owner_id.in_(accessible_user_ids)
    ).order_by(models.Brokerage.name).all()
    
    return brokerages

@router.post("/", response_model=schemas.BrokerageOut, status_code=status.HTTP_201_CREATED)
def create_brokerage(
    brokerage: schemas.BrokerageCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Create a new brokerage."""
    # Check if brokerage with same name already exists for this user
    existing = db.query(models.Brokerage).filter(
        models.Brokerage.owner_id == current_user.id,
        models.Brokerage.name == brokerage.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Brokerage '{brokerage.name}' already exists for your account"
        )
    
    db_brokerage = models.Brokerage(**brokerage.model_dump(), owner_id=current_user.id)
    db.add(db_brokerage)
    db.commit()
    db.refresh(db_brokerage)
    return db_brokerage

@router.get("/{brokerage_id}", response_model=schemas.BrokerageOut)
def get_brokerage(
    brokerage_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Get a specific brokerage by ID."""
    brokerage = db.query(models.Brokerage).filter(models.Brokerage.id == brokerage_id).first()
    if not brokerage:
        raise HTTPException(status_code=404, detail="Brokerage not found")
    
    # Check if user has access
    accessible_user_ids = get_accessible_user_ids(db, current_user.id, "accounts")
    if brokerage.owner_id not in accessible_user_ids:
        raise HTTPException(status_code=403, detail="You do not have permission to view this brokerage")
    
    return brokerage

@router.put("/{brokerage_id}", response_model=schemas.BrokerageOut)
def update_brokerage(
    brokerage_id: int,
    brokerage_update: schemas.BrokerageUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Update an existing brokerage (requires ownership)."""
    db_brokerage = db.query(models.Brokerage).filter(models.Brokerage.id == brokerage_id).first()
    if not db_brokerage:
        raise HTTPException(status_code=404, detail="Brokerage not found")
    
    # Check ownership
    if db_brokerage.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this brokerage")
    
    # If updating name, check for duplicates
    if brokerage_update.name and brokerage_update.name != db_brokerage.name:
        existing = db.query(models.Brokerage).filter(
            models.Brokerage.owner_id == current_user.id,
            models.Brokerage.name == brokerage_update.name,
            models.Brokerage.id != brokerage_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Brokerage '{brokerage_update.name}' already exists for your account"
            )
    
    update_data = brokerage_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_brokerage, field, value)
    
    db.commit()
    db.refresh(db_brokerage)
    return db_brokerage

@router.get("/{brokerage_id}/usage", response_model=dict)
def check_brokerage_usage(
    brokerage_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Check if a brokerage is in use (linked to any accounts)."""
    db_brokerage = db.query(models.Brokerage).filter(models.Brokerage.id == brokerage_id).first()
    if not db_brokerage:
        raise HTTPException(status_code=404, detail="Brokerage not found")
    
    # Check ownership
    if db_brokerage.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to check this brokerage")
    
    # Check if brokerage is linked to any accounts
    linked_accounts = db.query(models.Account).filter(models.Account.brokerage_id == brokerage_id).all()
    account_count = len(linked_accounts)
    
    return {
        "in_use": account_count > 0,
        "account_count": account_count,
        "account_names": [acc.account_name for acc in linked_accounts] if account_count > 0 else []
    }

@router.delete("/{brokerage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brokerage(
    brokerage_id: int,
    cascade: bool = False,
    retain: bool = False,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Delete a brokerage (requires ownership). 
    If cascade=True, will also delete all linked accounts (and their assets/liabilities).
    If retain=True, will delete the brokerage but keep accounts/assets/liabilities by removing their links.
    If cascade=False and retain=False (default), will only delete if not in use."""
    db_brokerage = db.query(models.Brokerage).filter(models.Brokerage.id == brokerage_id).first()
    if not db_brokerage:
        raise HTTPException(status_code=404, detail="Brokerage not found")
    
    # Check ownership
    if db_brokerage.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this brokerage")
    
    # Check if brokerage is linked to any accounts
    linked_accounts = db.query(models.Account).filter(models.Account.brokerage_id == brokerage_id).all()
    
    if linked_accounts:
        if retain:
            # Retain mode: delete brokerage but keep accounts/assets/liabilities by removing links
            for account in linked_accounts:
                # Remove account_id from all assets linked to this account
                db.query(models.Asset).filter(models.Asset.account_id == account.id).update(
                    {models.Asset.account_id: None},
                    synchronize_session=False
                )
                
                # Remove account_id from all liabilities linked to this account
                db.query(models.Liability).filter(models.Liability.account_id == account.id).update(
                    {models.Liability.account_id: None},
                    synchronize_session=False
                )
                
                # Remove brokerage_id from the account (this will orphan the account)
                account.brokerage_id = None
            
            # Now delete the brokerage
            db.delete(db_brokerage)
            db.commit()
            return None
        elif not cascade:
            account_names = [acc.account_name for acc in linked_accounts]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete brokerage '{db_brokerage.name}' because it is linked to {len(linked_accounts)} account(s): {', '.join(account_names)}"
            )
        else:
            # Cascade delete: delete all linked accounts and their assets/liabilities
            for account in linked_accounts:
                # Delete all assets linked to this account
                linked_assets = db.query(models.Asset).filter(models.Asset.account_id == account.id).all()
                for asset in linked_assets:
                    db.delete(asset)
                
                # Delete all liabilities linked to this account
                linked_liabilities = db.query(models.Liability).filter(models.Liability.account_id == account.id).all()
                for liability in linked_liabilities:
                    db.delete(liability)
                
                # Delete the account
                db.delete(account)
    
    db.delete(db_brokerage)
    db.commit()
    return None

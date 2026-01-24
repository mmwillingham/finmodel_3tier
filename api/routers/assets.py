from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

import models
import schemas
import auth
import database
from utils.permission_dependencies import get_accessible_user_ids
from utils.permissions import check_permission

router = APIRouter(
    prefix="/assets",
    tags=["assets"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    asset: schemas.AssetCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    # Default start_date to January 1 of current year if not provided
    asset_data = asset.model_dump()
    if not asset_data.get("start_date"):
        current_year = date.today().year
        asset_data["start_date"] = f"{current_year}-01-01"
    
    db_asset = models.Asset(**asset_data, owner_id=current_user.id)
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

@router.get("/", response_model=List[schemas.AssetOut])
def list_assets(
    viewing_user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List all assets the current user can access.
    If viewing_user_id is None, only show the current user's own assets.
    If viewing_user_id is provided, filter to that specific user's assets (must be accessible)."""
    
    # Default to only showing current user's assets when viewingUserId is None
    if viewing_user_id is None:
        accessible_user_ids = [current_user.id]
    else:
        # When viewing a specific user, check if they're accessible
        accessible_user_ids = get_accessible_user_ids(db, current_user.id, "items")
        if viewing_user_id not in accessible_user_ids:
            raise HTTPException(status_code=403, detail="You do not have access to view this user's data")
        accessible_user_ids = [viewing_user_id]
    
    assets = db.query(models.Asset).filter(models.Asset.owner_id.in_(accessible_user_ids)).all()
    return assets

@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(
    asset_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Get a specific asset by ID (requires view permission)."""
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Check permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=asset.owner_id,
        permission_type="items",
        required_permission="view"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to view this asset")
    
    return asset

@router.put("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(
    asset_id: int,
    asset: schemas.AssetUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Update an existing asset (requires edit permission)."""
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=db_asset.owner_id,
        permission_type="items",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this asset")
    
    update_data = asset.model_dump(exclude_unset=True)
    # Default start_date to January 1 of current year if being updated and not provided
    if "start_date" in update_data and not update_data["start_date"]:
        current_year = date.today().year
        update_data["start_date"] = f"{current_year}-01-01"
    for key, value in update_data.items():
        setattr(db_asset, key, value)
    
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Delete an asset (requires edit permission)."""
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=db_asset.owner_id,
        permission_type="items",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this asset")
    
    db.delete(db_asset)
    db.commit()
    return {"message": "Asset deleted successfully"}

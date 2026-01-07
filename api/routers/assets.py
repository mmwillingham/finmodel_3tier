from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
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
    prefix="/assets",
    tags=["assets"],
    responses={404: {"description": "Not found"}},
)
logger.info("Assets router initialized.")

@router.post("/", response_model=schemas.AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    asset: schemas.AssetCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    db_asset = models.Asset(**asset.model_dump(), owner_id=current_user.id)
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

@router.get("/", response_model=List[schemas.AssetOut])
def list_assets(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List all assets the current user can access (own or authorized)."""
    logger.debug(f"list_assets: User ID: {current_user.id}")
    accessible_user_ids = get_accessible_user_ids(db, current_user.id, "items")
    assets = db.query(models.Asset).filter(models.Asset.owner_id.in_(accessible_user_ids)).all()
    logger.debug(f"list_assets: Found {len(assets)} assets for user {current_user.id}")
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

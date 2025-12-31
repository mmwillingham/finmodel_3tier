from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import auth
import database
import logging

logger = logging.getLogger(__name__)

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
    logger.debug(f"list_assets: User ID: {current_user.id}")
    assets = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id).all()
    logger.debug(f"list_assets: Found {len(assets)} assets for user {current_user.id}")
    return assets

@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(
    asset_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id, models.Asset.owner_id == current_user.id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset

@router.put("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(
    asset_id: int,
    asset: schemas.AssetUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id, models.Asset.owner_id == current_user.id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
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
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id, models.Asset.owner_id == current_user.id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(db_asset)
    db.commit()
    return {"message": "Asset deleted successfully"}

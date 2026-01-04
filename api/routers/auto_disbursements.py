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
    prefix="/auto-disbursements",
    tags=["auto-disbursements"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.AutoDisbursementOut])
def list_auto_disbursements(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List all auto-disbursement rules for the current user."""
    disbursements = db.query(models.AutoDisbursement).filter(
        models.AutoDisbursement.owner_id == current_user.id
    ).order_by(models.AutoDisbursement.name).all()
    return disbursements

@router.post("/", response_model=schemas.AutoDisbursementOut, status_code=status.HTTP_201_CREATED)
def create_auto_disbursement(
    disbursement: schemas.AutoDisbursementCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Create a new auto-disbursement rule."""
    # Verify source and target assets belong to the user
    source_asset = db.query(models.Asset).filter(
        models.Asset.id == disbursement.source_asset_id,
        models.Asset.owner_id == current_user.id
    ).first()
    if not source_asset:
        raise HTTPException(status_code=404, detail="Source asset not found")
    
    target_asset = db.query(models.Asset).filter(
        models.Asset.id == disbursement.target_asset_id,
        models.Asset.owner_id == current_user.id
    ).first()
    if not target_asset:
        raise HTTPException(status_code=404, detail="Target asset not found")
    
    if disbursement.transfer_type not in ["percentage", "dollar_amount"]:
        raise HTTPException(status_code=400, detail="Transfer type must be 'percentage' or 'dollar_amount'")
    
    if disbursement.transfer_type == "percentage" and (disbursement.transfer_value < 0 or disbursement.transfer_value > 100):
        raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
    
    db_disbursement = models.AutoDisbursement(**disbursement.model_dump(), owner_id=current_user.id)
    db.add(db_disbursement)
    db.commit()
    db.refresh(db_disbursement)
    return db_disbursement

@router.get("/{disbursement_id}", response_model=schemas.AutoDisbursementOut)
def get_auto_disbursement(
    disbursement_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Get a specific auto-disbursement rule by ID."""
    disbursement = db.query(models.AutoDisbursement).filter(
        models.AutoDisbursement.id == disbursement_id,
        models.AutoDisbursement.owner_id == current_user.id
    ).first()
    if not disbursement:
        raise HTTPException(status_code=404, detail="Auto-disbursement rule not found")
    return disbursement

@router.put("/{disbursement_id}", response_model=schemas.AutoDisbursementOut)
def update_auto_disbursement(
    disbursement_id: int,
    disbursement_update: schemas.AutoDisbursementUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Update an existing auto-disbursement rule."""
    db_disbursement = db.query(models.AutoDisbursement).filter(
        models.AutoDisbursement.id == disbursement_id,
        models.AutoDisbursement.owner_id == current_user.id
    ).first()
    if not db_disbursement:
        raise HTTPException(status_code=404, detail="Auto-disbursement rule not found")
    
    # Verify source and target assets if being updated
    if disbursement_update.source_asset_id is not None:
        source_asset = db.query(models.Asset).filter(
            models.Asset.id == disbursement_update.source_asset_id,
            models.Asset.owner_id == current_user.id
        ).first()
        if not source_asset:
            raise HTTPException(status_code=404, detail="Source asset not found")
    
    if disbursement_update.target_asset_id is not None:
        target_asset = db.query(models.Asset).filter(
            models.Asset.id == disbursement_update.target_asset_id,
            models.Asset.owner_id == current_user.id
        ).first()
        if not target_asset:
            raise HTTPException(status_code=404, detail="Target asset not found")
    
    if disbursement_update.transfer_type is not None and disbursement_update.transfer_type not in ["percentage", "dollar_amount"]:
        raise HTTPException(status_code=400, detail="Transfer type must be 'percentage' or 'dollar_amount'")
    
    if disbursement_update.transfer_type == "percentage" and disbursement_update.transfer_value is not None:
        if disbursement_update.transfer_value < 0 or disbursement_update.transfer_value > 100:
            raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
    
    update_data = disbursement_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_disbursement, field, value)
    
    db.commit()
    db.refresh(db_disbursement)
    return db_disbursement

@router.delete("/{disbursement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_auto_disbursement(
    disbursement_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Delete an auto-disbursement rule."""
    db_disbursement = db.query(models.AutoDisbursement).filter(
        models.AutoDisbursement.id == disbursement_id,
        models.AutoDisbursement.owner_id == current_user.id
    ).first()
    if not db_disbursement:
        raise HTTPException(status_code=404, detail="Auto-disbursement rule not found")
    
    db.delete(db_disbursement)
    db.commit()
    return None


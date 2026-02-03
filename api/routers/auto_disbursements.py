from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import auth
import database
from utils.permission_dependencies import get_accessible_user_ids
from utils.rmd import calculate_rmd
from datetime import datetime, date


ALLOWED_DISTRIBUTION_TYPES = {None, "", "taxable_ira", "non_taxable"}


router = APIRouter(
    prefix="/auto-disbursements",
    tags=["auto-disbursements"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.AutoDisbursementOut])
def list_auto_disbursements(
    viewing_user_id: int | None = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List auto-disbursement rules for the specified user (or current user)."""
    target_user = current_user.id
    if viewing_user_id:
        accessible_ids = get_accessible_user_ids(
            db=db,
            current_user_id=current_user.id,
            permission_type="financial_data",
        )
        if viewing_user_id not in accessible_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view those auto-disbursements.")
        target_user = viewing_user_id

    disbursements = db.query(models.AutoDisbursement).filter(
        models.AutoDisbursement.owner_id == target_user
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
    
    # Validate distribution_type if present
    if getattr(disbursement, "distribution_type", None) not in ALLOWED_DISTRIBUTION_TYPES:
        raise HTTPException(status_code=400, detail="Invalid distribution_type")
    
    db_disbursement = models.AutoDisbursement(**disbursement.model_dump(), owner_id=current_user.id)
    db.add(db_disbursement)
    db.commit()
    db.refresh(db_disbursement)
    # Handle taxable IRA distribution creation of income item if requested
    if getattr(disbursement, "distribution_type", None) == "taxable_ira":
        # Ensure source and target assets are proper types (source retirement, target non-retirement)
        source_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.source_asset_id, models.Asset.owner_id == current_user.id).first()
        target_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.target_asset_id, models.Asset.owner_id == current_user.id).first()
        # Attempt to find account retirement flags if available
        source_account = None
        target_account = None
        if source_asset and source_asset.account_id:
            source_account = db.query(models.Account).filter(models.Account.id == source_asset.account_id).first()
        if target_asset and target_asset.account_id:
            target_account = db.query(models.Account).filter(models.Account.id == target_asset.account_id).first()
        if not source_account or not source_account.is_retirement:
            raise HTTPException(status_code=400, detail="Source must be a retirement account for taxable IRA distributions")
        if target_account and target_account.is_retirement:
            raise HTTPException(status_code=400, detail="Target must be a non-retirement account for taxable IRA distributions")
        # Create a taxable income CashFlowItem to represent the distribution (if not exists)
        description = f"Taxable distribution - {db_disbursement.name}"
        existing = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == current_user.id, models.CashFlowItem.description == description).first()
        if not existing:
            cash_item = models.CashFlowItem(
                owner_id=current_user.id,
                is_income=True,
                category="Distributions",
                description=description,
                frequency="yearly",
                yearly_value=0.0,
                annual_increase_percent=0.0,
                inflation_percent=0.0,
                taxable=True,
            )
            db.add(cash_item)
            db.commit()
            db.refresh(cash_item)
            db_disbursement.taxable_income_cashflow_item_id = cash_item.id
            db.commit()
        else:
            db_disbursement.taxable_income_cashflow_item_id = existing.id
            db.commit()
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
    
    # Validate distribution_type if present
    if getattr(disbursement_update, "distribution_type", None) not in ALLOWED_DISTRIBUTION_TYPES:
        raise HTTPException(status_code=400, detail="Invalid distribution_type")
    
    update_data = disbursement_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_disbursement, field, value)
    
    db.commit()
    db.refresh(db_disbursement)
    # If distribution_type changed to taxable_ira, ensure taxable cashflow item exists
    if getattr(disbursement_update, "distribution_type", None) == "taxable_ira":
        # Create or ensure cashflow item exists as in create endpoint
        description = f"Taxable distribution - {db_disbursement.name}"
        existing = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == current_user.id, models.CashFlowItem.description == description).first()
        if not existing:
            cash_item = models.CashFlowItem(
                owner_id=current_user.id,
                is_income=True,
                category="Distributions",
                description=description,
                frequency="yearly",
                yearly_value=0.0,
                annual_increase_percent=0.0,
                inflation_percent=0.0,
                taxable=True,
            )
            db.add(cash_item)
            db.commit()
            db.refresh(cash_item)
            db_disbursement.taxable_income_cashflow_item_id = cash_item.id
            db.commit()
        else:
            db_disbursement.taxable_income_cashflow_item_id = existing.id
            db.commit()
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


@router.get("/rmd", tags=["auto-disbursements"])
def get_rmd_for_asset(asset_id: int, year: int | None = None, years: int | None = None, db: Session = Depends(database.get_db), current_user: schemas.UserOut = Depends(auth.get_current_user)):
    """
    Compute RMD for an asset owned by the current user.
    If `year` provided and `years` is None -> return single-year result.
    If `years` provided -> returns list of results for year..year+years-1 (default year=today).
    Uses asset.value as prior-year-end balance unless caller overrides.
    """
    if year is None:
        year = date.today().year
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id, models.Asset.owner_id == current_user.id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    # Get owner's birthdate from user settings
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    if not user_settings or not user_settings.person1_birthdate:
        raise HTTPException(status_code=400, detail="Person 1 birthdate required in profile settings to compute RMD")
    spouse_bd = user_settings.person2_birthdate if user_settings.person2_birthdate else None
    # Use asset.value as prior-year-end balance (caller may override)
    balance = asset.value or 0.0
    if years and years > 1:
        results = []
        for y in range(year, year + years):
            results.append(calculate_rmd(user_settings.person1_birthdate, balance, y, spouse_bd))
        return results
    r = calculate_rmd(user_settings.person1_birthdate, balance, year, spouse_bd)
    return r


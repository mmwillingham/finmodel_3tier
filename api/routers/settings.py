from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import database
import auth

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    responses={404: {"description": "Not found"}},
)

@router.get("", response_model=schemas.UserSettingsOut)
def get_user_settings(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    
    if not user_settings:
        # If user-specific settings don't exist, try to get global defaults
        global_settings = db.query(models.GlobalSettings).first()
        
        if global_settings:
            # Create user settings based on global defaults
            user_settings = models.UserSettings(
                owner_id=current_user.id,
                asset_categories=global_settings.asset_categories,
                liability_categories=global_settings.liability_categories,
                income_categories=global_settings.income_categories,
                expense_categories=global_settings.expense_categories,
                # Other fields will use their default values from the model
            )
        else:
            # Fallback to hardcoded defaults if no global settings exist
            user_settings = models.UserSettings(
                owner_id=current_user.id,
                liability_categories=["Other", "Mortgage", "Student Loan", "Car Loan"],
                asset_categories=["Other", "Checking", "Savings", "Investment"],
                income_categories=["Salary", "Rental Income", "Investments"],
                expense_categories=["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"]
            )
        db.add(user_settings)
        db.commit()
        db.refresh(user_settings)
    return user_settings

@router.put("", response_model=schemas.UserSettingsOut)
def update_user_settings(
    settings_update: schemas.UserSettingsUpdate,
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    
    if not user_settings:
        # If settings don't exist, create default ones based on global settings or hardcoded defaults
        global_settings = db.query(models.GlobalSettings).first()
        if global_settings:
            user_settings = models.UserSettings(
                owner_id=current_user.id,
                asset_categories=global_settings.asset_categories,
                liability_categories=global_settings.liability_categories,
                income_categories=global_settings.income_categories,
                expense_categories=global_settings.expense_categories,
            )
        else:
            user_settings = models.UserSettings(owner_id=current_user.id) # Uses model defaults
        db.add(user_settings)
        db.commit()
        db.refresh(user_settings)

    # Update fields only if provided in the payload
    update_data = settings_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        # Skip updating email as it belongs to the User model
        if key == "email":
            continue
        setattr(user_settings, key, value)

    db.commit()
    db.refresh(user_settings)
    return user_settings

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
        # If settings don't exist, create default ones
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settings not found")

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

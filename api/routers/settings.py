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
    if settings_update.liability_categories is not None:
        user_settings.liability_categories = settings_update.liability_categories
    if settings_update.asset_categories is not None:
        user_settings.asset_categories = settings_update.asset_categories
    if settings_update.income_categories is not None:
        user_settings.income_categories = settings_update.income_categories
    if settings_update.expense_categories is not None:
        user_settings.expense_categories = settings_update.expense_categories

    db.commit()
    db.refresh(user_settings)
    return user_settings

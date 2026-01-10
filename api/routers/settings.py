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

    # Detect category renames and update all related items
    update_data = settings_update.model_dump(exclude_unset=True)
    
    # Helper function to find category renames by comparing old and new lists
    def find_category_renames(old_list, new_list):
        """Find category renames by matching by position, assuming order preservation"""
        renames = {}
        if not old_list or not new_list:
            return renames
        
        old_list = list(old_list) if old_list else []
        new_list = list(new_list) if new_list else []
        
        # Match categories by position if lengths match (most common case for renames)
        if len(old_list) == len(new_list):
            for i, (old_cat, new_cat) in enumerate(zip(old_list, new_list)):
                if old_cat != new_cat:
                    renames[old_cat] = new_cat
        else:
            # If lengths differ, try to match by similarity or let user re-save items
            # For now, we'll skip rename detection if lengths don't match
            pass
        
        return renames
    
    # Check for category renames and update related items
    if "asset_categories" in update_data:
        old_asset_cats = user_settings.asset_categories or []
        new_asset_cats = update_data["asset_categories"] or []
        asset_renames = find_category_renames(old_asset_cats, new_asset_cats)
        if asset_renames:
            for old_name, new_name in asset_renames.items():
                db.query(models.Asset).filter(
                    models.Asset.owner_id == current_user.id,
                    models.Asset.category == old_name
                ).update({"category": new_name}, synchronize_session=False)
    
    if "liability_categories" in update_data:
        old_liability_cats = user_settings.liability_categories or []
        new_liability_cats = update_data["liability_categories"] or []
        liability_renames = find_category_renames(old_liability_cats, new_liability_cats)
        if liability_renames:
            for old_name, new_name in liability_renames.items():
                db.query(models.Liability).filter(
                    models.Liability.owner_id == current_user.id,
                    models.Liability.category == old_name
                ).update({"category": new_name}, synchronize_session=False)
    
    if "income_categories" in update_data:
        old_income_cats = user_settings.income_categories or []
        new_income_cats = update_data["income_categories"] or []
        income_renames = find_category_renames(old_income_cats, new_income_cats)
        if income_renames:
            for old_name, new_name in income_renames.items():
                db.query(models.CashFlowItem).filter(
                    models.CashFlowItem.owner_id == current_user.id,
                    models.CashFlowItem.is_income == True,
                    models.CashFlowItem.category == old_name
                ).update({"category": new_name}, synchronize_session=False)
    
    if "expense_categories" in update_data:
        old_expense_cats = user_settings.expense_categories or []
        new_expense_cats = update_data["expense_categories"] or []
        expense_renames = find_category_renames(old_expense_cats, new_expense_cats)
        if expense_renames:
            for old_name, new_name in expense_renames.items():
                db.query(models.CashFlowItem).filter(
                    models.CashFlowItem.owner_id == current_user.id,
                    models.CashFlowItem.is_income == False,
                    models.CashFlowItem.category == old_name
                ).update({"category": new_name}, synchronize_session=False)
    
    # Update fields only if provided in the payload
    for key, value in update_data.items():
        # Skip updating email as it belongs to the User model
        if key == "email":
            continue
        setattr(user_settings, key, value)

    db.commit()
    db.refresh(user_settings)
    return user_settings

@router.get("/default-categories", response_model=schemas.GlobalSettingsBase)
def get_default_categories(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Get default categories from global settings (read-only for all users).
    """
    global_settings = db.query(models.GlobalSettings).first()
    if not global_settings:
        # Return hardcoded defaults if no global settings exist
        return schemas.GlobalSettingsBase(
            asset_categories=["Other", "Checking", "Savings", "Investment"],
            liability_categories=["Other", "Mortgage", "Student Loan", "Car Loan"],
            income_categories=["Salary", "Rental Income", "Investments"],
            expense_categories=["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"]
        )
    return schemas.GlobalSettingsBase(
        asset_categories=global_settings.asset_categories,
        liability_categories=global_settings.liability_categories,
        income_categories=global_settings.income_categories,
        expense_categories=global_settings.expense_categories
    )

@router.post("/load-default-categories", response_model=schemas.UserSettingsOut)
def load_default_categories(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Load default categories into user settings, merging with existing categories (avoiding duplicates).
    """
    # Get user settings
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    
    if not user_settings:
        # If settings don't exist, create them with default categories
        global_settings = db.query(models.GlobalSettings).first()
        if global_settings:
            user_settings = models.UserSettings(
                owner_id=current_user.id,
                asset_categories=list(global_settings.asset_categories) if global_settings.asset_categories else [],
                liability_categories=list(global_settings.liability_categories) if global_settings.liability_categories else [],
                income_categories=list(global_settings.income_categories) if global_settings.income_categories else [],
                expense_categories=list(global_settings.expense_categories) if global_settings.expense_categories else [],
            )
        else:
            user_settings = models.UserSettings(
                owner_id=current_user.id,
                asset_categories=["Other", "Checking", "Savings", "Investment"],
                liability_categories=["Other", "Mortgage", "Student Loan", "Car Loan"],
                income_categories=["Salary", "Rental Income", "Investments"],
                expense_categories=["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"]
            )
        db.add(user_settings)
        db.commit()
        db.refresh(user_settings)
        return user_settings
    
    # Get default categories
    global_settings = db.query(models.GlobalSettings).first()
    if global_settings:
        default_asset = global_settings.asset_categories or []
        default_liability = global_settings.liability_categories or []
        default_income = global_settings.income_categories or []
        default_expense = global_settings.expense_categories or []
    else:
        default_asset = ["Other", "Checking", "Savings", "Investment"]
        default_liability = ["Other", "Mortgage", "Student Loan", "Car Loan"]
        default_income = ["Salary", "Rental Income", "Investments"]
        default_expense = ["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"]
    
    # Merge categories, avoiding duplicates
    def merge_categories(existing, defaults):
        merged = list(existing) if existing else []
        for cat in defaults:
            if cat not in merged:
                merged.append(cat)
        return merged
    
    user_settings.asset_categories = merge_categories(user_settings.asset_categories, default_asset)
    user_settings.liability_categories = merge_categories(user_settings.liability_categories, default_liability)
    user_settings.income_categories = merge_categories(user_settings.income_categories, default_income)
    user_settings.expense_categories = merge_categories(user_settings.expense_categories, default_expense)
    
    db.commit()
    db.refresh(user_settings)
    return user_settings

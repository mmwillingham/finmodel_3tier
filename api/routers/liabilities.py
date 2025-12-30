from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
import logging

import models
import schemas
import auth
import database
from calculations import calculate_amortized_loan_balance

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/liabilities",
    tags=["liabilities"],
)

@router.post("/", response_model=schemas.LiabilityOut, status_code=status.HTTP_201_CREATED)
async def create_liability(
    liability: schemas.LiabilityCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    if liability.loan_type == "amortized" and not liability.loan_start_date:
        raise HTTPException(status_code=400, detail="loan_start_date is required for amortized loans")

    db_liability = models.Liability(**liability.model_dump(exclude_unset=True), owner_id=current_user.id)
    db.add(db_liability)
    db.commit()
    db.refresh(db_liability)

    # Handle linked cash flow for amortized loans
    if db_liability.loan_type == "amortized" and db_liability.include_in_cash_flow:
        # Calculate the monthly payment based on the initial loan amount (principal)
        # For simplicity, we'll assume the initial_loan_amount is the principal for payment calculation
        # In a real scenario, you'd calculate this based on original terms, not current balance.
        # This assumes the 'value' or 'initial_loan_amount' is what's used for payment calculation
        # If monthly_payment is provided, use it; otherwise, estimate based on interest rate and term (if available)
        monthly_payment_value = db_liability.monthly_payment if db_liability.monthly_payment is not None else (
            (db_liability.initial_loan_amount * (db_liability.interest_rate / 12 / 100)) /
            (1 - (1 + (db_liability.interest_rate / 12 / 100))**(-db_liability.loan_term_months)) if db_liability.loan_term_months and db_liability.initial_loan_amount else 0
        )

        cash_flow_item = models.CashFlowItem(
            owner_id=current_user.id,
            is_income=False,
            category=db_liability.category or "Loan Payment", # Use liability category or default
            description=f"Loan payment for {db_liability.name}",
            frequency="monthly",
            yearly_value=monthly_payment_value * 12,
            annual_increase_percent=0.0, # Loan payments typically don't increase with inflation
            inflation_percent=0.0,
            person=db_liability.person,
            start_date=db_liability.loan_start_date, # Start date of cash flow is loan start date
            end_date=db_liability.loan_end_date, # End date of cash flow is loan end date
            taxable=False,
            tax_deductible=db_liability.tax_deductible if db_liability.tax_deductible is not None else False,
            linked_item_id=db_liability.id,
            linked_item_type="liability",
            percentage=None # Not applicable for fixed loan payments
        )
        db.add(cash_flow_item)
        db.commit()
        db.refresh(cash_flow_item)

    return db_liability

@router.get("/", response_model=List[schemas.LiabilityOut])
def list_liabilities(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    logger.debug(f"list_liabilities: User ID: {current_user.id}")
    liabilities = db.query(models.Liability).filter(models.Liability.owner_id == current_user.id).all()
    logger.debug(f"list_liabilities: Found {len(liabilities)} liabilities for user {current_user.id}")
    return liabilities

@router.get("/{liability_id}", response_model=schemas.LiabilityOut)
def get_liability(
    liability_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    liability = db.query(models.Liability).filter(models.Liability.id == liability_id, models.Liability.owner_id == current_user.id).first()
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")
    return liability

@router.put("/{liability_id}", response_model=schemas.LiabilityOut)
async def update_liability(
    liability_id: int,
    liability_update: schemas.LiabilityUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    db_liability = db.query(models.Liability).filter(models.Liability.id == liability_id, models.Liability.owner_id == current_user.id).first()
    if not db_liability:
        raise HTTPException(status_code=404, detail="Liability not found")

    update_data = liability_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_liability, key, value)
    
    # Handle specific logic for amortized loans if loan_type is being set or already is amortized
    if db_liability.loan_type == "amortized":
        if "loan_start_date" in update_data and not db_liability.loan_start_date:
            raise HTTPException(status_code=400, detail="loan_start_date is required for amortized loans")
        
        # Update or create linked cash flow for amortized loans
        if db_liability.include_in_cash_flow:
            monthly_payment_value = db_liability.monthly_payment if db_liability.monthly_payment is not None else (
                (db_liability.initial_loan_amount * (db_liability.interest_rate / 12 / 100)) /
                (1 - (1 + (db_liability.interest_rate / 12 / 100))**(-db_liability.loan_term_months)) if db_liability.loan_term_months and db_liability.initial_loan_amount else 0
            )

            cash_flow_item = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.linked_item_id == db_liability.id,
                models.CashFlowItem.linked_item_type == "liability"
            ).first()

            if cash_flow_item:
                # Update existing cash flow item
                cash_flow_item.category = db_liability.category or "Loan Payment"
                cash_flow_item.description = f"Loan payment for {db_liability.name}"
                cash_flow_item.yearly_value = monthly_payment_value * 12
                cash_flow_item.person = db_liability.person
                cash_flow_item.start_date = db_liability.loan_start_date
                cash_flow_item.end_date = db_liability.loan_end_date
                cash_flow_item.tax_deductible = db_liability.tax_deductible if db_liability.tax_deductible is not None else False
                db.add(cash_flow_item)
            else:
                # Create new cash flow item if it doesn't exist and should be included
                new_cash_flow_item = models.CashFlowItem(
                    owner_id=current_user.id,
                    is_income=False,
                    category=db_liability.category or "Loan Payment",
                    description=f"Loan payment for {db_liability.name}",
                    frequency="monthly",
                    yearly_value=monthly_payment_value * 12,
                    annual_increase_percent=0.0,
                    inflation_percent=0.0,
                    person=db_liability.person,
                    start_date=db_liability.loan_start_date,
                    end_date=db_liability.loan_end_date,
                    taxable=False,
                    tax_deductible=db_liability.tax_deductible if db_liability.tax_deductible is not None else False,
                    linked_item_id=db_liability.id,
                    linked_item_type="liability",
                    percentage=None
                )
                db.add(new_cash_flow_item)
        elif not db_liability.include_in_cash_flow: # If it was previously included but now isn't
            # Delete linked cash flow item if it exists
            cash_flow_item = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.linked_item_id == db_liability.id,
                models.CashFlowItem.linked_item_type == "liability"
            ).first()
            if cash_flow_item:
                db.delete(cash_flow_item)

    db.commit()
    db.refresh(db_liability)
    return db_liability

@router.delete("/{liability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_liability(
    liability_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    db_liability = db.query(models.Liability).filter(models.Liability.id == liability_id, models.Liability.owner_id == current_user.id).first()
    if not db_liability:
        raise HTTPException(status_code=404, detail="Liability not found")
    
    # Delete any linked cash flow item
    cash_flow_item = db.query(models.CashFlowItem).filter(
        models.CashFlowItem.linked_item_id == liability_id,
        models.CashFlowItem.linked_item_type == "liability"
    ).first()
    if cash_flow_item:
        db.delete(cash_flow_item)

    db.delete(db_liability)
    db.commit()
    return {"message": "Liability deleted successfully"}

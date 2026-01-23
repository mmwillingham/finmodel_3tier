from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import models
import schemas
import database
from utils.tax_calculator import calculate_state_taxable_income

FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)"
STATE_TAX_EXPENSE_DESCRIPTION = "State Income Tax (Calculated)"

router = APIRouter(
    prefix="/tax",
    tags=["tax"],
    responses={404: {"description": "Not found"}},
)


@router.get("/state", response_model=schemas.StateTaxResult)
def calculate_state_tax(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    if not user_settings:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User settings not found.")

    if not user_settings.calculate_state_tax:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State tax calculation is not enabled for this account."
        )

    if not user_settings.state or not user_settings.tax_filing_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State and filing status must be defined to calculate state tax."
        )

    income_items = db.query(models.CashFlowItem).filter(
        models.CashFlowItem.owner_id == current_user.id,
        models.CashFlowItem.is_income == True,
        models.CashFlowItem.yearly_value.isnot(None)
    ).all()

    expense_items = db.query(models.CashFlowItem).filter(
        models.CashFlowItem.owner_id == current_user.id,
        models.CashFlowItem.is_income == False,
        models.CashFlowItem.yearly_value.isnot(None)
    ).all()

    total_income = sum(item.yearly_value for item in income_items if item.taxable and item.yearly_value)
    tax_deductible_expenses = sum(
        item.yearly_value for item in expense_items
        if item.tax_deductible and item.yearly_value and item.description not in {FEDERAL_TAX_EXPENSE_DESCRIPTION, STATE_TAX_EXPENSE_DESCRIPTION}
    )

    state_taxable_income, state_standard_deduction, state_tax_owed = calculate_state_taxable_income(
        total_income,
        tax_deductible_expenses,
        user_settings.state,
        user_settings.tax_filing_status,
        federal_tax_owed=0.0
    )

    return schemas.StateTaxResult(
        state_taxable_income=state_taxable_income,
        state_standard_deduction=state_standard_deduction,
        state_tax=state_tax_owed
    )

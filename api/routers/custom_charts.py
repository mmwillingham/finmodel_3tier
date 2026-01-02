from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json
import logging

import schemas
import models
import calculations
from database import get_db
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/custom_charts",
    tags=["Custom Charts"],
    responses={404: {"description": "Not found"}},
)

def fetch_and_convert_item(db: Session, current_user: models.User, item_type: str, item_id: int):
    logger.debug(f"Attempting to fetch item_type: {item_type}, item_id: {item_id}")
    if item_type == 'assets':
        item = db.query(models.Asset).filter(models.Asset.id == item_id, models.Asset.owner_id == current_user.id).first()
        if item:
            logger.debug(f"Found asset: {item.name} (ID: {item.id}, Value: {item.value})")

            # NEW: Calculate total monthly contributions to this asset from expense CashFlowItems
            contributing_expenses = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.owner_id == current_user.id,
                models.CashFlowItem.is_income == False, # Only consider expenses
                models.CashFlowItem.contributes_to_asset_id == item_id
            ).all()

            total_contributions = sum(cf_item.yearly_value for cf_item in contributing_expenses)

            return schemas.ProjectedAccountCreate(
                name=item.name,
                account_type='asset',
                initial_value=item.value,
                contribution=total_contributions / 12, # Use calculated contributions
                growth_rate=item.annual_increase_percent,
                # Loan specific fields are not applicable for assets
                loan_type=None,
                principal_amount=None,
                interest_rate=None,
                loan_term_months=None,
                loan_start_date=None,
                monthly_payment=None
            )
        else:
            logger.warning(f"Asset with ID {item_id} not found for user {current_user.id}")
    elif item_type == 'liabilities':
        item = db.query(models.Liability).filter(models.Liability.id == item_id, models.Liability.owner_id == current_user.id).first()
        if item:
            logger.debug(f"Found liability: {item.name} (ID: {item.id}, Value: {item.value})")
            return schemas.ProjectedAccountCreate(
                name=item.name,
                account_type='liability',
                initial_value=-abs(item.value),
                contribution=0.0, # Monthly payment is handled within amortized loan logic
                growth_rate=item.annual_increase_percent,
                loan_type=item.loan_type,
                principal_amount=item.principal_amount,
                interest_rate=item.interest_rate,
                loan_term_months=item.loan_term_months,
                loan_start_date=item.loan_start_date,
                monthly_payment=item.monthly_payment
            )
        else:
            logger.warning(f"Liability with ID {item_id} not found for user {current_user.id}")
    elif item_type in ['income', 'expenses']:
        is_income_item = (item_type == 'income')
        
        item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
        if item:
            logger.debug(f"Found cashflow item: {item.description} (ID: {item.id}, Yearly Value: {item.yearly_value}, Is Dynamic: {bool(item.linked_item_id)})")
            
            account_type = 'income' if is_income_item else 'expense'
            
            return schemas.ProjectedAccountCreate(
                name=item.description,
                account_type=account_type,
                initial_value=0.0, # Income is a flow, not a balance
                contribution=item.yearly_value / 12 if is_income_item else -(item.yearly_value / 12),
                growth_rate=item.annual_increase_percent if is_income_item else item.inflation_percent,
                # Loan specific fields are not applicable for income/expense
                loan_type=None,
                principal_amount=None,
                interest_rate=None,
                loan_term_months=None,
                loan_start_date=None,
                monthly_payment=None
            )
        else:
            logger.warning(f"CashFlowItem with ID {item_id} not found for user {current_user.id}")
    return None

@router.post("/", response_model=schemas.CustomChartOut, status_code=status.HTTP_201_CREATED)
def create_custom_chart(
    chart: schemas.CustomChartCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    logger.debug(f"Entering create_custom_chart for user {current_user.id}")

    series_configs = json.loads(chart.series_configurations)
    accounts_for_projection = []
    
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    projection_years = user_settings.projection_years if user_settings else 30

    logger.debug(f"Parsed series configurations: {series_configs}")
    logger.debug(f"Projection years from user settings: {projection_years}")
    
    for series_config in series_configs:
        item_type = series_config.get('data_type')
        item_id = series_config.get('item_id')

        if item_type and item_id: # Specific item selected
            account = fetch_and_convert_item(db, current_user, item_type, item_id)
            if account:
                accounts_for_projection.append(account)
            else:
                logger.warning(f"Could not find item {item_id} of type {item_type} for user {current_user.id}")
        elif item_type and item_id is None: # Aggregate type selected (e.g., "all income")
            if item_type == 'assets':
                items = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id).all()
                for item in items:
                    accounts_for_projection.append(schemas.ProjectedAccountCreate(
                        name=item.name,
                        account_type='asset',
                        initial_value=item.value,
                        contribution=0.0, # Assets typically don't have direct monthly contributions
                        growth_rate=item.annual_increase_percent,
                    ))
            elif item_type == 'liabilities':
                items = db.query(models.Liability).filter(models.Liability.owner_id == current_user.id).all()
                for item in items:
                    # For liabilities, initial_value should be negative
                    accounts_for_projection.append(schemas.ProjectedAccountCreate(
                        name=item.name,
                        account_type='liability',
                        initial_value=-abs(item.value),
                        contribution=0.0, # Monthly payment is handled within amortized loan logic
                        growth_rate=item.annual_increase_percent,
                        loan_type=item.loan_type,
                        principal_amount=item.principal_amount,
                        interest_rate=item.interest_rate,
                        loan_term_months=item.loan_term_months,
                        loan_start_date=item.loan_start_date,
                        monthly_payment=item.monthly_payment
                    ))
            elif item_type == 'income':
                items = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == current_user.id, models.CashFlowItem.is_income == True).all()
                for item in items:
                    accounts_for_projection.append(schemas.ProjectedAccountCreate(
                        name=item.description,
                        account_type='income',
                        initial_value=0.0, # Income is a flow, not a balance
                        contribution=item.yearly_value / 12, # Monthly contribution
                        growth_rate=item.annual_increase_percent,
                    ))
            elif item_type == 'expenses':
                items = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == current_user.id, models.CashFlowItem.is_income == False).all()
                for item in items:
                    # Expenses are negative contributions
                    accounts_for_projection.append(schemas.ProjectedAccountCreate(
                        name=item.description,
                        account_type='expense',
                        initial_value=0.0, # Expenses are a flow, not a balance
                        contribution=-(item.yearly_value / 12), # Negative monthly contribution
                        growth_rate=item.inflation_percent, # Expenses grow by inflation
                    ))
            else:
                logger.warning(f"Unsupported aggregate item type: {item_type} for user {current_user.id}")
        else:
            logger.warning(f"Invalid series config: {series_config}")

    logger.debug(f"Accounts prepared for projection: {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)}")

    try:
        projection_results = calculations.calculate_projection(
            years=projection_years,
            accounts=accounts_for_projection, # Removed .model_dump()
            db=db,
            owner_id=current_user.id
        )
        logger.debug(f"Projection calculation successful. Final Value: {projection_results['final_value']}")
        logger.debug(f"data_json content before saving in create_custom_chart: {projection_results.get('data_json')}") # Debug log for create
    except Exception as e:
        logger.error(f"Error during projection calculation for chart {chart.name}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed: {e}")

    db_chart = models.CustomChart(
        **chart.model_dump(exclude_unset=True),
        user_id=current_user.id,
        data_json=projection_results["data_json"],
        final_value=projection_results["final_value"],
        total_contributed=projection_results["total_contributed"],
        total_growth=projection_results["total_growth"]
    )
    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    logger.debug(f"Custom chart {db_chart.name} created with ID {db_chart.id} and projection results.")
    return db_chart

@router.get("/", response_model=List[schemas.CustomChartOut])
def read_custom_charts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    charts = db.query(models.CustomChart).filter(models.CustomChart.user_id == current_user.id).all()
    return charts

@router.get("/{chart_id}", response_model=schemas.CustomChartOut)
def read_custom_chart(
    chart_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id).first()
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    return chart

@router.put("/{chart_id}", response_model=schemas.CustomChartOut)
def update_custom_chart(
    chart_id: int,
    chart_update: schemas.CustomChartUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    logger.debug(f"Entering update_custom_chart for chart ID {chart_id}, user {current_user.id}")

    chart_query = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id)
    db_chart = chart_query.first()

    if not db_chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    if chart_update.series_configurations:
        series_configs = json.loads(chart_update.series_configurations)
        accounts_for_projection = []

        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
        projection_years = user_settings.projection_years if user_settings else 30
        
        logger.debug(f"Parsed series configurations for update: {series_configs}")

        for series_config in series_configs:
            item_type = series_config.get('data_type')
            item_id = series_config.get('item_id')
            if item_type and item_id:
                account = fetch_and_convert_item(db, current_user, item_type, item_id)
                if account:
                    accounts_for_projection.append(account)
                else:
                    logger.warning(f"Could not find item {item_id} of type {item_type} for user {current_user.id} during chart update.")
            elif item_type and item_id is None: # Aggregate type selected (e.g., "all income")
                if item_type == 'assets':
                    items = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id).all()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.name,
                            account_type='asset',
                            initial_value=item.value,
                            contribution=0.0, # Assets typically don't have direct monthly contributions
                            growth_rate=item.annual_increase_percent,
                        ))
                elif item_type == 'liabilities':
                    items = db.query(models.Liability).filter(models.Liability.owner_id == current_user.id).all()
                    for item in items:
                        # For liabilities, initial_value should be negative
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.name,
                            account_type='liability',
                            initial_value=-abs(item.value),
                            contribution=0.0, # Monthly payment is handled within amortized loan logic
                            growth_rate=item.annual_increase_percent,
                            loan_type=item.loan_type,
                            principal_amount=item.principal_amount,
                            interest_rate=item.interest_rate,
                            loan_term_months=item.loan_term_months,
                            loan_start_date=item.loan_start_date,
                            monthly_payment=item.monthly_payment
                        ))
                elif item_type == 'income':
                    items = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == current_user.id, models.CashFlowItem.is_income == True).all()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.description,
                            account_type='income',
                            initial_value=0.0, # Income is a flow, not a balance
                            contribution=item.yearly_value / 12, # Monthly contribution
                            growth_rate=item.annual_increase_percent,
                        ))
                elif item_type == 'expenses':
                    items = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == current_user.id, models.CashFlowItem.is_income == False).all()
                    for item in items:
                        # Expenses are negative contributions
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.description,
                            account_type='expense',
                            initial_value=0.0, # Expenses are a flow, not a balance
                            contribution=-(item.yearly_value / 12), # Negative monthly contribution
                            growth_rate=item.inflation_percent, # Expenses grow by inflation
                        ))
                else:
                    logger.warning(f"Unsupported aggregate item type: {item_type} for user {current_user.id}")

        logger.debug(f"Accounts prepared for projection update: {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)}")

        try:
            projection_results = calculations.calculate_projection(
                years=projection_years,
                accounts=accounts_for_projection, # Removed .model_dump()
                db=db,
                owner_id=current_user.id
            )
            logger.debug(f"Projection calculation successful for chart update. Final Value: {projection_results['final_value']}")
            logger.debug(f"data_json content before saving in update_custom_chart: {projection_results.get('data_json')}") # Debug log for update
            db_chart.data_json = projection_results["data_json"]
            db_chart.final_value = projection_results["final_value"]
            db_chart.total_contributed = projection_results["total_contributed"]
            db_chart.total_growth = projection_results["total_growth"]
        except Exception as e:
            logger.error(f"Error during projection calculation for chart update {db_chart.name}: {e}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed during update: {e}")

    update_data = chart_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key not in ["data_json", "final_value", "total_contributed", "total_growth"]:
            setattr(db_chart, key, value)

    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    logger.debug(f"Custom chart {db_chart.name} (ID: {db_chart.id}) updated with projection results.")
    return db_chart

@router.delete("/{chart_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_chart(
    chart_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id)
    if not chart.first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    chart.delete(synchronize_session=False)
    db.commit()
    return {"detail": "Custom chart deleted successfully"}

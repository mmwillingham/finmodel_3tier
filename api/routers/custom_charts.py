from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json
import logging # Import logging module

import schemas
import models
import calculations
from database import get_db
from auth import get_current_user

logger = logging.getLogger(__name__) # Initialize logger for custom_charts.py

router = APIRouter(
    prefix="/custom_charts",
    tags=["Custom Charts"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.CustomChartOut, status_code=status.HTTP_201_CREATED)
def create_custom_chart(
    chart: schemas.CustomChartCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    logger.debug(f"Entering create_custom_chart for user {current_user.id}") # Changed from print to logger.debug

    # 1. Parse series_configurations to extract items for projection
    series_configs = json.loads(chart.series_configurations)
    accounts_for_projection = []
    
    # Fetch user settings for projection years
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).first()
    projection_years = user_settings.projection_years if user_settings else 30 # Default to 30 if no settings

    logger.debug(f"Parsed series configurations: {series_configs}") # Changed from print to logger.debug
    logger.debug(f"Projection years from user settings: {projection_years}") # Changed from print to logger.debug

def fetch_and_convert_item(db: Session, current_user: models.User, item_type: str, item_id: int):
    logger.debug(f"Attempting to fetch item_type: {item_type}, item_id: {item_id}")
    if item_type == 'assets':
        item = db.query(models.Asset).filter(models.Asset.id == item_id, models.Asset.owner_id == current_user.id).first()
        if item:
            logger.debug(f"Found asset: {item.name} (ID: {item.id}, Value: {item.value})")
            return schemas.AccountSchema(
                name=item.name,
                type='asset',
                initial_balance=item.value,
                monthly_contribution=0.0,
                annual_increase_percent=item.annual_increase_percent,
                annual_change_type=item.annual_change_type
            )
        else:
            logger.warning(f"Asset with ID {item_id} not found for user {current_user.id}")
    elif item_type == 'liabilities':
        item = db.query(models.Liability).filter(models.Liability.id == item_id, models.Liability.owner_id == current_user.id).first()
        if item:
            logger.debug(f"Found liability: {item.name} (ID: {item.id}, Value: {item.value})")
            return schemas.AccountSchema(
                name=item.name,
                type='liability',
                initial_balance=item.value,
                monthly_contribution=0.0,
                annual_increase_percent=item.annual_increase_percent,
                annual_change_type=item.annual_change_type
            )
        else:
            logger.warning(f"Liability with ID {item_id} not found for user {current_user.id}")
    elif item_type in ['income', 'expenses']:
        # Determine if it's income or expense based on the item_type parameter
        is_income_item = (item_type == 'income')
        
        item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
        if item:
            logger.debug(f"Found cashflow item: {item.description} (ID: {item.id}, Yearly Value: {item.yearly_value}, Is Dynamic: {bool(item.linked_item_id)})")
            
            # The type for AccountSchema should be 'income' or 'expense', not 'incomeItems' or 'expenseItems'
            account_type = 'income' if is_income_item else 'expense'
            
            return schemas.AccountSchema(
                name=item.description,
                type=account_type,
                initial_balance=0.0,
                monthly_contribution=item.yearly_value / 12,
                annual_increase_percent=item.annual_increase_percent if is_income_item else item.inflation_percent,
                annual_change_type='increase' if is_income_item else 'decrease'
            )
        else:
            logger.warning(f"CashFlowItem with ID {item_id} not found for user {current_user.id}")
    return None
    
    for series_config in series_configs:
        item_type = series_config.get('data_type')
        item_id = series_config.get('item_id') # Assuming item_id is passed in series_configurations

        if item_type and item_id:
            account = fetch_and_convert_item(db, current_user, item_type, item_id)
            if account:
                accounts_for_projection.append(account)
            else:
                logger.warning(f"Could not find item {item_id} of type {item_type} for user {current_user.id}") # Changed from print to logger.warning
        else:
            logger.warning(f"Invalid series config: {series_config}") # Changed from print to logger.warning

    logger.debug(f"Accounts prepared for projection: {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)}") # Changed from print to logger.debug

    # 2. Call calculate_projection
    try:
        projection_results = calculations.calculate_projection(
            years=projection_years,
            accounts=[acc.model_dump() for acc in accounts_for_projection],
            db=db,
            owner_id=current_user.id
        )
        logger.debug(f"Projection calculation successful. Final Value: {projection_results['final_value']}") # Changed from print to logger.debug
    except Exception as e:
        logger.error(f"Error during projection calculation for chart {chart.name}: {e}", exc_info=True) # Changed from print to logger.error, added exc_info
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed: {e}")

    # 3. Create the CustomChart model instance with projection results
    db_chart = models.CustomChart(
        **chart.model_dump(exclude_unset=True), # Use exclude_unset=True to allow partial updates for new fields
        user_id=current_user.id,
        data_json=projection_results["data_json"],
        final_value=projection_results["final_value"],
        total_contributed=projection_results["total_contributed"],
        total_growth=projection_results["total_growth"]
    )
    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    logger.debug(f"Custom chart {db_chart.name} created with ID {db_chart.id} and projection results.") # Changed from print to logger.debug
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
    logger.debug(f"Entering update_custom_chart for chart ID {chart_id}, user {current_user.id}") # Changed from print to logger.debug

    chart_query = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id)
    db_chart = chart_query.first()

    if not db_chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    # Only recalculate projection if series_configurations are provided in the update
    if chart_update.series_configurations:
        series_configs = json.loads(chart_update.series_configurations)
        accounts_for_projection = []

        user_settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).first()
        projection_years = user_settings.projection_years if user_settings else 30
        
        logger.debug(f"Parsed series configurations for update: {series_configs}") # Changed from print to logger.debug

        item_type = series_config.get('data_type')
        item_id = series_config.get('item_id')
        if item_type and item_id:
            account = fetch_and_convert_item(db, current_user, item_type, item_id)
                if account:
                    accounts_for_projection.append(account)
                else:
                    logger.warning(f"Could not find item {item_id} of type {item_type} for user {current_user.id} during chart update.") # Changed from print to logger.warning

        logger.debug(f"Accounts prepared for projection update: {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)}") # Changed from print to logger.debug

        try:
            projection_results = calculations.calculate_projection(
                years=projection_years,
                accounts=[acc.model_dump() for acc in accounts_for_projection],
                db=db,
                owner_id=current_user.id
            )
            logger.debug(f"Projection calculation successful for chart update. Final Value: {projection_results['final_value']}") # Changed from print to logger.debug
            db_chart.data_json = projection_results["data_json"]
            db_chart.final_value = projection_results["final_value"]
            db_chart.total_contributed = projection_results["total_contributed"]
            db_chart.total_growth = projection_results["total_growth"]
        except Exception as e:
            logger.error(f"Error during projection calculation for chart update {db_chart.name}: {e}", exc_info=True) # Changed from print to logger.error, added exc_info
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed during update: {e}")

    # Update other fields from chart_update payload
    update_data = chart_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key not in ["data_json", "final_value", "total_contributed", "total_growth"]:
            setattr(db_chart, key, value)

    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    logger.debug(f"Custom chart {db_chart.name} (ID: {db_chart.id}) updated with projection results.") # Changed from print to logger.debug
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
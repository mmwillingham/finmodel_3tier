import json
import logging
import traceback
import sys

print(f"--- DEBUG: api/routers/custom_charts.py LOADED ---"); sys.stdout.flush()

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

import models
import schemas
from database import get_db
from auth import get_current_user
# Removed: from api import calculations # This will now be lazy-loaded inside functions


logger = logging.getLogger(__name__)

try:
    router = APIRouter(
        prefix="/custom_charts",
        tags=["Custom Charts"],
        responses={404: {"description": "Not found"}},
    )
    print(f"--- DEBUG: Custom Charts Router instantiated with prefix: {router.prefix} ---"); sys.stdout.flush() # NEW DEBUG
except Exception as e:
    print(f"--- CRITICAL ERROR: Failed to instantiate Custom Charts Router: {e} (Traceback: {traceback.format_exc()}) ---"); sys.stdout.flush()
    raise

def fetch_and_convert_item(db: Session, current_user: models.User, item_type: str, item_id: int) -> Optional[schemas.ProjectedAccountCreate]:
    print(f"--- DEBUG: Attempting to fetch item_type: {item_type}, item_id: {item_id} ---"); sys.stdout.flush()
    if item_type == 'assets':
        item = db.query(models.Asset).filter(models.Asset.id == item_id, models.Asset.owner_id == current_user.id).first()
        if item:
            print(f"--- DEBUG: Found asset: {item.name} (ID: {item.id}, Value: {item.value}) ---"); sys.stdout.flush()
            contributing_expenses = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.owner_id == current_user.id,
                models.CashFlowItem.is_income == False,
                models.CashFlowItem.contributes_to_asset_id == item_id
            ).all()
            total_contributions = sum(cf_item.yearly_value for cf_item in contributing_expenses)
            return schemas.ProjectedAccountCreate(
                name=item.name,
                account_type='asset',
                initial_value=item.value,
                contribution=total_contributions / 12,
                growth_rate=item.annual_increase_percent,
                loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
            )
        else:
            print(f"--- WARNING: Asset with ID {item_id} not found for user {current_user.id} ---"); sys.stdout.flush()
    elif item_type == 'liabilities':
        item = db.query(models.Liability).filter(models.Liability.id == item_id, models.Liability.owner_id == current_user.id).first()
        if item:
            print(f"--- DEBUG: Found liability: {item.name} (ID: {item.id}, Value: {item.value}) ---"); sys.stdout.flush()
            return schemas.ProjectedAccountCreate(
                name=item.name,
                account_type='liability',
                initial_value=-abs(item.value),
                contribution=0.0,
                growth_rate=item.annual_increase_percent,
                loan_type=item.loan_type,
                principal_amount=item.principal_amount,
                interest_rate=item.interest_rate,
                loan_term_months=item.loan_term_months,
                loan_start_date=item.loan_start_date,
                monthly_payment=item.monthly_payment
            )
        else:
            print(f"--- WARNING: Liability with ID {item_id} not found for user {current_user.id} ---"); sys.stdout.flush()
    elif item_type in ['income', 'expenses']:
        is_income_item = (item_type == 'income')
        item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
        if item:
            print(f"--- DEBUG: Found cashflow item: {item.description} (ID: {item.id}, Yearly Value: {item.yearly_value}, Is Dynamic: {bool(item.linked_item_id)}) ---"); sys.stdout.flush()
            account_type = 'income' if is_income_item else 'expense'
            return schemas.ProjectedAccountCreate(
                name=item.description,
                account_type=account_type,
                initial_value=0.0,
                contribution=item.yearly_value / 12 if is_income_item else -(item.yearly_value / 12),
                growth_rate=item.annual_increase_percent if is_income_item else item.inflation_percent,
                loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
            )
        else:
            print(f"--- WARNING: CashFlowItem with ID {item_id} not found for user {current_user.id} ---"); sys.stdout.flush()
    return None

@router.post("", response_model=schemas.CustomChartOut, status_code=status.HTTP_201_CREATED)
def create_custom_chart(
    chart: schemas.CustomChartCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    print(f"--- DEBUG: TOP OF create_custom_chart function. User ID: {current_user.id} ---"); sys.stdout.flush()
    try:
        print(f"--- DEBUG: Entering create_custom_chart for user {current_user.id} ---"); sys.stdout.flush()

        # Check for duplicate chart name
        existing_chart = db.query(models.CustomChart).filter(
            models.CustomChart.user_id == current_user.id,
            models.CustomChart.name == chart.name
        ).first()
        if existing_chart:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"A chart with the name '{chart.name}' already exists. Please choose a different name.")

        series_configs = json.loads(chart.series_configurations)
        accounts_for_projection = []
        
        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
        projection_years = user_settings.projection_years if user_settings else 30

        print(f"--- DEBUG: Parsed series configurations: {series_configs} ---"); sys.stdout.flush()
        print(f"--- DEBUG: Projection years from user settings: {projection_years} ---"); sys.stdout.flush()
        
        for series_config in series_configs:
            item_type = series_config.get('data_type')
            # Check both item_id and selected_item_id for compatibility
            # Handle None, empty string, or 0 as "no item selected"
            item_id = series_config.get('item_id') or series_config.get('selected_item_id')
            if item_id == "" or item_id == 0:
                item_id = None
            elif item_id is not None:
                # Convert to integer if it's a string (JSON numbers can come as strings)
                try:
                    item_id = int(item_id)
                except (ValueError, TypeError):
                    print(f"--- WARNING: Invalid item_id format: {item_id}, skipping ---"); sys.stdout.flush()
                    continue
            category = series_config.get('category')

            if item_type and item_id: # Specific item selected
                account = fetch_and_convert_item(db, current_user, item_type, item_id)
                if account:
                    accounts_for_projection.append(account)
                else:
                    print(f"--- WARNING: Could not find item {item_id} of type {item_type} for user {current_user.id} ---"); sys.stdout.flush()
            elif item_type and item_id is None: # Aggregate type selected (e.g., "all income" or "all items in a category")
                if item_type == 'assets':
                    query = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id)
                    if category:  # Filter by category if specified
                        query = query.filter(models.Asset.category == category)
                        print(f"--- DEBUG: Filtering assets by category: {category} ---"); sys.stdout.flush()
                    items = query.all()
                    print(f"--- DEBUG: Found {len(items)} assets for item_type={item_type}, category={category} ---"); sys.stdout.flush()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.name,
                            account_type='asset',
                            initial_value=item.value,
                            contribution=0.0,
                            growth_rate=item.annual_increase_percent,
                        ))
                elif item_type == 'liabilities':
                    query = db.query(models.Liability).filter(models.Liability.owner_id == current_user.id)
                    if category:  # Filter by category if specified
                        query = query.filter(models.Liability.category == category)
                    items = query.all()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.name,
                            account_type='liability',
                            initial_value=-abs(item.value),
                            contribution=0.0,
                            growth_rate=item.annual_increase_percent,
                            loan_type=item.loan_type,
                            principal_amount=item.principal_amount,
                            interest_rate=item.interest_rate,
                            loan_term_months=item.loan_term_months,
                            loan_start_date=item.loan_start_date,
                            monthly_payment=item.monthly_payment
                        ))
                elif item_type == 'income':
                    query = db.query(models.CashFlowItem).filter(
                        models.CashFlowItem.owner_id == current_user.id,
                        models.CashFlowItem.is_income == True
                    )
                    if category:  # Filter by category if specified
                        query = query.filter(models.CashFlowItem.category == category)
                    items = query.all()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.description,
                            account_type='income',
                            initial_value=0.0,
                            contribution=item.yearly_value / 12,
                            growth_rate=item.annual_increase_percent,
                        ))
                elif item_type == 'expenses':
                    query = db.query(models.CashFlowItem).filter(
                        models.CashFlowItem.owner_id == current_user.id,
                        models.CashFlowItem.is_income == False
                    )
                    if category:  # Filter by category if specified
                        query = query.filter(models.CashFlowItem.category == category)
                        print(f"--- DEBUG: Filtering expense items by category: {category} ---"); sys.stdout.flush()
                    items = query.all()
                    print(f"--- DEBUG: Found {len(items)} expense items for item_type={item_type}, category={category} ---"); sys.stdout.flush()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.description,
                            account_type='expense',
                            initial_value=0.0,
                            contribution=-(item.yearly_value / 12),
                            growth_rate=item.inflation_percent,
                        ))
                else:
                    print(f"--- WARNING: Unsupported aggregate item type: {item_type} for user {current_user.id} ---"); sys.stdout.flush()
            else:
                print(f"--- WARNING: Invalid series config: {series_config} ---"); sys.stdout.flush()

        print(f"--- DEBUG: Accounts prepared for projection (after loop): {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)} ---"); sys.stdout.flush() # NEW DEBUG LINE
        print(f"--- DEBUG: Attempting to call calculate_projection for chart {chart.name} ---"); sys.stdout.flush() # NEW DEBUG LINE
        
        import calculations # Lazy import (absolute import like liabilities.py uses)
        projection_results = calculations.calculate_projection(
            years=projection_years,
            accounts=accounts_for_projection,
            db=db,
            owner_id=current_user.id
        )
        print(f"--- DEBUG: Projection calculation successful. Final Value: {projection_results['final_value']} ---"); sys.stdout.flush()
        print(f"--- DEBUG: data_json content after calculation, before model assignment: {projection_results.get('data_json')} ---"); sys.stdout.flush() # NEW DEBUG LINE
        print(f"--- DEBUG: data_json content before saving in create_custom_chart: {projection_results.get('data_json')} ---"); sys.stdout.flush() # Debug log for create

        # Explicitly assign each field to ensure data_json is not missed
        db_chart = models.CustomChart(
            name=chart.name,
            chart_type=chart.chart_type,
            display_type=chart.display_type,
            data_sources=chart.data_sources,
            series_configurations=chart.series_configurations,
            x_axis_label=chart.x_axis_label,
            y_axis_label=chart.y_axis_label,
            user_id=current_user.id,
            data_json=projection_results["data_json"],
            final_value=projection_results["final_value"],
            total_contributed=projection_results["total_contributed"],
            total_growth=projection_results["total_growth"]
        )
        db.add(db_chart)
        db.commit()
        db.refresh(db_chart)
        print(f"--- DEBUG: Custom chart {db_chart.name} created with ID {db_chart.id} and projection results. ---"); sys.stdout.flush()
        return db_chart
    except Exception as e:
        print(f"--- CRITICAL ERROR in create_custom_chart: {e} (Traceback: {traceback.format_exc()}) ---"); sys.stdout.flush()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed: {e}")

@router.get("", response_model=List[schemas.CustomChartOut])
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
    print(f"--- DEBUG: data_json content AFTER retrieval from DB in read_custom_chart (ID: {chart_id}): {chart.data_json} ---"); sys.stdout.flush()
    return chart

@router.put("/{chart_id}", response_model=schemas.CustomChartOut)
def update_custom_chart(
    chart_id: int,
    chart_update: schemas.CustomChartUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    print(f"--- DEBUG: Entering update_custom_chart for chart ID {chart_id}, user {current_user.id} ---"); sys.stdout.flush()

    chart_query = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id)
    db_chart = chart_query.first()

    if not db_chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    if chart_update.series_configurations:
        series_configs = json.loads(chart_update.series_configurations)
        accounts_for_projection = []

        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
        projection_years = user_settings.projection_years if user_settings else 30
        
        print(f"--- DEBUG: Parsed series configurations for update: {series_configs} ---"); sys.stdout.flush()

        for series_config in series_configs:
            item_type = series_config.get('data_type')
            # Check both item_id and selected_item_id for compatibility
            # Handle None, empty string, or 0 as "no item selected"
            item_id = series_config.get('item_id') or series_config.get('selected_item_id')
            if item_id == "" or item_id == 0:
                item_id = None
            elif item_id is not None:
                # Convert to integer if it's a string (JSON numbers can come as strings)
                try:
                    item_id = int(item_id)
                except (ValueError, TypeError):
                    print(f"--- WARNING: Invalid item_id format: {item_id}, skipping ---"); sys.stdout.flush()
                    continue
            category = series_config.get('category')
            if item_type and item_id:
                account = fetch_and_convert_item(db, current_user, item_type, item_id)
                if account:
                    accounts_for_projection.append(account)
                else:
                    print(f"--- WARNING: Could not find item {item_id} of type {item_type} for user {current_user.id} during chart update. ---"); sys.stdout.flush()
            elif item_type and item_id is None:
                if item_type == 'assets':
                    query = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id)
                    if category:  # Filter by category if specified
                        query = query.filter(models.Asset.category == category)
                    items = query.all()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.name,
                            account_type='asset',
                            initial_value=item.value,
                            contribution=0.0,
                            growth_rate=item.annual_increase_percent,
                        ))
                elif item_type == 'liabilities':
                    query = db.query(models.Liability).filter(models.Liability.owner_id == current_user.id)
                    if category:  # Filter by category if specified
                        query = query.filter(models.Liability.category == category)
                    items = query.all()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.name,
                            account_type='liability',
                            initial_value=-abs(item.value),
                            contribution=0.0,
                            growth_rate=item.annual_increase_percent,
                            loan_type=item.loan_type,
                            principal_amount=item.principal_amount,
                            interest_rate=item.interest_rate,
                            loan_term_months=item.loan_term_months,
                            loan_start_date=item.loan_start_date,
                            monthly_payment=item.monthly_payment
                        ))
                elif item_type == 'income':
                    query = db.query(models.CashFlowItem).filter(
                        models.CashFlowItem.owner_id == current_user.id,
                        models.CashFlowItem.is_income == True
                    )
                    if category:  # Filter by category if specified
                        query = query.filter(models.CashFlowItem.category == category)
                    items = query.all()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.description,
                            account_type='income',
                            initial_value=0.0,
                            contribution=item.yearly_value / 12,
                            growth_rate=item.annual_increase_percent,
                        ))
                elif item_type == 'expenses':
                    query = db.query(models.CashFlowItem).filter(
                        models.CashFlowItem.is_income == False,
                        models.CashFlowItem.owner_id == current_user.id
                    )
                    if category:  # Filter by category if specified
                        query = query.filter(models.CashFlowItem.category == category)
                    items = query.all()
                    for item in items:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=item.description,
                            account_type='expense',
                            initial_value=0.0,
                            contribution=-(item.yearly_value / 12),
                            growth_rate=item.inflation_percent,
                        ))
                else:
                    print(f"--- WARNING: Unsupported aggregate item type: {item_type} for user {current_user.id} ---"); sys.stdout.flush()
            else:
                print(f"--- WARNING: Invalid series config: {series_config} ---"); sys.stdout.flush()

        print(f"--- DEBUG: Accounts prepared for projection update: {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)} ---"); sys.stdout.flush()

        try:
            import calculations # Lazy import (absolute import like liabilities.py uses)
            projection_results = calculations.calculate_projection(
                years=projection_years,
                accounts=accounts_for_projection,
                db=db,
                owner_id=current_user.id
            )
            print(f"--- DEBUG: Projection calculation successful for chart update. Final Value: {projection_results['final_value']} ---"); sys.stdout.flush()
            print(f"--- DEBUG: data_json content before saving in update_custom_chart: {projection_results.get('data_json')} ---"); sys.stdout.flush() # Debug log for update
            db_chart.data_json = projection_results["data_json"]
            db_chart.final_value = projection_results["final_value"]
            db_chart.total_contributed = projection_results["total_contributed"]
            db_chart.total_growth = projection_results["total_growth"]
        except Exception as e:
            print(f"--- CRITICAL ERROR: Error during projection calculation for chart update {db_chart.name}: {e} (Traceback: {traceback.format_exc()}) ---"); sys.stdout.flush()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed during update: {e}")

    update_data = chart_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key not in ["data_json", "final_value", "total_contributed", "total_growth"]:
            setattr(db_chart, key, value)

    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    print(f"--- DEBUG: Custom chart {db_chart.name} (ID: {db_chart.id}) updated with projection results. ---"); sys.stdout.flush()
    return db_chart

@router.delete("/{chart_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_chart(
    chart_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    print(f"--- DEBUG: Entering delete_custom_chart for chart ID {chart_id}, user {current_user.id} ---"); sys.stdout.flush()
    db_chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id).first()
    if not db_chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    db.delete(db_chart)
    db.commit()
    print(f"--- DEBUG: Custom chart {chart_id} deleted. ---"); sys.stdout.flush()
    return {"ok": True}

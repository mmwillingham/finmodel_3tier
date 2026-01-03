from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import logging
import traceback

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

def fetch_and_convert_item(db: Session, current_user: models.User, item_type: str, item_id: int) -> Optional[schemas.ProjectedAccountCreate]:
    print(f"--- DEBUG: Attempting to fetch item_type: {item_type}, item_id: {item_id} (Traceback: {traceback.format_exc()}) ---")
    if item_type == 'assets':
        item = db.query(models.Asset).filter(models.Asset.id == item_id, models.Asset.owner_id == current_user.id).first()
        if item:
            print(f"--- DEBUG: Found asset: {item.name} (ID: {item.id}, Value: {item.value}) (Traceback: {traceback.format_exc()}) ---")

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
            print(f"--- WARNING: Asset with ID {item_id} not found for user {current_user.id} (Traceback: {traceback.format_exc()}) ---")
    elif item_type == 'liabilities':
        item = db.query(models.Liability).filter(models.Liability.id == item_id, models.Liability.owner_id == current_user.id).first()
        if item:
            print(f"--- DEBUG: Found liability: {item.name} (ID: {item.id}, Value: {item.value}) (Traceback: {traceback.format_exc()}) ---")
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
            print(f"--- WARNING: Liability with ID {item_id} not found for user {current_user.id} (Traceback: {traceback.format_exc()}) ---")
    elif item_type in ['income', 'expenses']:
        is_income_item = (item_type == 'income')
        
        item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
        if item:
            print(f"--- DEBUG: Found cashflow item: {item.description} (ID: {item.id}, Yearly Value: {item.yearly_value}, Is Dynamic: {bool(item.linked_item_id)}) (Traceback: {traceback.format_exc()}) ---")
            
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
            print(f"--- WARNING: CashFlowItem with ID {item_id} not found for user {current_user.id} (Traceback: {traceback.format_exc()}) ---")
    return None

@router.post("/", response_model=schemas.CustomChartOut, status_code=status.HTTP_201_CREATED)
def create_custom_chart(
    chart: schemas.CustomChartCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    print(f"--- DEBUG: Entering create_custom_chart for user {current_user.id} (Traceback: {traceback.format_exc()}) ---")

    series_configs = json.loads(chart.series_configurations)
    accounts_for_projection = []
    
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    projection_years = user_settings.projection_years if user_settings else 30

    print(f"--- DEBUG: Parsed series configurations: {series_configs} (Traceback: {traceback.format_exc()}) ---")
    print(f"--- DEBUG: Projection years from user settings: {projection_years} (Traceback: {traceback.format_exc()}) ---")
    
    for series_config in series_configs:
        item_type = series_config.get('data_type')
        item_id = series_config.get('item_id')

        if item_type and item_id: # Specific item selected
            account = fetch_and_convert_item(db, current_user, item_type, item_id)
            if account:
                accounts_for_projection.append(account)
            else:
                print(f"--- WARNING: Could not find item {item_id} of type {item_type} for user {current_user.id} (Traceback: {traceback.format_exc()}) ---")
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
                print(f"--- WARNING: Unsupported aggregate item type: {item_type} for user {current_user.id} (Traceback: {traceback.format_exc()}) ---")
        else:
            print(f"--- WARNING: Invalid series config: {series_config} (Traceback: {traceback.format_exc()}) ---")

    print(f"--- DEBUG: Accounts prepared for projection (after loop): {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)} (Traceback: {traceback.format_exc()}) ---") # NEW DEBUG LINE
    print(f"--- DEBUG: Attempting to call calculate_projection for chart {chart.name} (Traceback: {traceback.format_exc()}) ---") # NEW DEBUG LINE
    try:
        projection_results = calculations.calculate_projection(
            years=projection_years,
            accounts=accounts_for_projection, # Removed .model_dump()
            db=db,
            owner_id=current_user.id
        )
        print(f"--- DEBUG: Projection calculation successful. Final Value: {projection_results['final_value']} (Traceback: {traceback.format_exc()}) ---")
        print(f"--- DEBUG: data_json content after calculation, before model assignment: {projection_results.get('data_json')} (Traceback: {traceback.format_exc()}) ---") # NEW DEBUG LINE
        print(f"--- DEBUG: data_json content before saving in create_custom_chart: {projection_results.get('data_json')} (Traceback: {traceback.format_exc()}) ---") # Debug log for create
    except Exception as e:
        print(f"--- ERROR: Error during projection calculation for chart {chart.name}: {e} (Traceback: {traceback.format_exc()}) ---")
        print(f"--- TRACEBACK: {traceback.format_exc()} ---")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed: {e}")

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
    print(f"--- DEBUG: Custom chart {db_chart.name} created with ID {db_chart.id} and projection results. (Traceback: {traceback.format_exc()}) ---")
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
    print(f"--- DEBUG: data_json content AFTER retrieval from DB in read_custom_chart (ID: {chart_id}): {chart.data_json} (Traceback: {traceback.format_exc()}) ---")
    return chart

@router.put("/{chart_id}", response_model=schemas.CustomChartOut)
def update_custom_chart(
    chart_id: int,
    chart_update: schemas.CustomChartUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    print(f"--- DEBUG: Entering update_custom_chart for chart ID {chart_id}, user {current_user.id} (Traceback: {traceback.format_exc()}) ---")

    chart_query = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id)
    db_chart = chart_query.first()

    if not db_chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    if chart_update.series_configurations:
        series_configs = json.loads(chart_update.series_configurations)
        accounts_for_projection = []

        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
        projection_years = user_settings.projection_years if user_settings else 30
        
        print(f"--- DEBUG: Parsed series configurations for update: {series_configs} (Traceback: {traceback.format_exc()}) ---")

        for series_config in series_configs:
            item_type = series_config.get('data_type')
            item_id = series_config.get('item_id')
            if item_type and item_id:
                account = fetch_and_convert_item(db, current_user, item_type, item_id)
                if account:
                    accounts_for_projection.append(account)
                else:
                    print(f"--- WARNING: Could not find item {item_id} of type {item_type} for user {current_user.id} during chart update. (Traceback: {traceback.format_exc()}) ---")
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
                print(f"--- WARNING: Unsupported aggregate item type: {item_type} for user {current_user.id} (Traceback: {traceback.format_exc()}) ---")
        else:
            print(f"--- WARNING: Invalid series config: {series_config} (Traceback: {traceback.format_exc()}) ---")

        print(f"--- DEBUG: Accounts prepared for projection update: {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)} (Traceback: {traceback.format_exc()}) ---")

        try:
            projection_results = calculations.calculate_projection(
                years=projection_years,
                accounts=accounts_for_projection, # Removed .model_dump()
                db=db,
                owner_id=current_user.id
            )
            print(f"--- DEBUG: Projection calculation successful for chart update. Final Value: {projection_results['final_value']} (Traceback: {traceback.format_exc()}) ---")
            print(f"--- DEBUG: data_json content before saving in update_custom_chart: {projection_results.get('data_json')} (Traceback: {traceback.format_exc()}) ---") # Debug log for update
            db_chart.data_json = projection_results["data_json"]
            db_chart.final_value = projection_results["final_value"]
            db_chart.total_contributed = projection_results["total_contributed"]
            db_chart.total_growth = projection_results["total_growth"]
        except Exception as e:
                print(f"--- ERROR: Error during projection calculation for chart update {db_chart.name}: {e} (Traceback: {traceback.format_exc()}) ---")
                print(f"--- TRACEBACK: {traceback.format_exc()} ---")
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed during update: {e}")

    # Explicitly assign each field to ensure data_json is not missed
    db_chart.name = chart_update.name if chart_update.name is not None else db_chart.name
    db_chart.chart_type = chart_update.chart_type if chart_update.chart_type is not None else db_chart.chart_type
    db_chart.display_type = chart_update.display_type if chart_update.display_type is not None else db_chart.display_type
    db_chart.data_sources = chart_update.data_sources if chart_update.data_sources is not None else db_chart.data_sources
    db_chart.series_configurations = chart_update.series_configurations if chart_update.series_configurations is not None else db_chart.series_configurations
    db_chart.x_axis_label = chart_update.x_axis_label if chart_update.x_axis_label is not None else db_chart.x_axis_label
    db_chart.y_axis_label = chart_update.y_axis_label if chart_update.y_axis_label is not None else db_chart.y_axis_label
    # data_json, final_value, total_contributed, total_growth are handled above after projection calculation

    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    print(f"--- DEBUG: Custom chart {db_chart.name} (ID: {db_chart.id}) updated with projection results. (Traceback: {traceback.format_exc()}) ---")
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
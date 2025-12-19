from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

import schemas
import models
import calculations
from database import get_db
from auth import get_current_user

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
    print(f"DEBUG (custom_charts.py): Entering create_custom_chart for user {current_user.id}")

    # 1. Parse series_configurations to extract items for projection
    series_configs = json.loads(chart.series_configurations)
    accounts_for_projection = []
    
    # Fetch user settings for projection years
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).first()
    projection_years = user_settings.projection_years if user_settings else 30 # Default to 30 if no settings

    print(f"DEBUG (custom_charts.py): Parsed series configurations: {series_configs}")
    print(f"DEBUG (custom_charts.py): Projection years from user settings: {projection_years}")

    # Helper to fetch and convert items to AccountSchema
    def fetch_and_convert_item(item_type: str, item_id: int):
        print(f"DEBUG (custom_charts.py): Attempting to fetch item_type: {item_type}, item_id: {item_id}")
        if item_type == 'asset':
            item = db.query(models.Asset).filter(models.Asset.id == item_id, models.Asset.owner_id == current_user.id).first()
            if item:
                print(f"DEBUG (custom_charts.py): Found asset: {item.name} (ID: {item.id}, Value: {item.value})")
                return schemas.AccountSchema(
                    name=item.name,
                    type='asset',
                    initial_balance=item.value,
                    monthly_contribution=0.0, # Assets don't have monthly contribution directly for chart projection
                    annual_increase_percent=item.annual_increase_percent,
                    annual_change_type=item.annual_change_type
                )
            else:
                print(f"DEBUG (custom_charts.py): Asset with ID {item_id} not found for user {current_user.id}")
        elif item_type == 'liability':
            item = db.query(models.Liability).filter(models.Liability.id == item_id, models.Liability.owner_id == current_user.id).first()
            if item:
                print(f"DEBUG (custom_charts.py): Found liability: {item.name} (ID: {item.id}, Value: {item.value})")
                return schemas.AccountSchema(
                    name=item.name,
                    type='liability',
                    initial_balance=item.value,
                    monthly_contribution=0.0, # Liabilities don't have monthly contribution directly for chart projection
                    annual_increase_percent=item.annual_increase_percent,
                    annual_change_type=item.annual_change_type
                )
            else:
                print(f"DEBUG (custom_charts.py): Liability with ID {item_id} not found for user {current_user.id}")
        elif item_type in ['income', 'expense']:
            item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
            if item:
                print(f"DEBUG (custom_charts.py): Found cashflow item: {item.description} (ID: {item.id}, Yearly Value: {item.yearly_value}, Is Dynamic: {bool(item.linked_item_id)})")
                # For cash flow items, the yearly_value is either static or calculated dynamically later
                # We initially use the stored yearly_value, which for dynamic items will be 0.0 before resolution
                return schemas.AccountSchema(
                    name=item.description,
                    type='income' if item.is_income else 'expense',
                    initial_balance=0.0, # Cashflow items don't have an initial balance in this context
                    monthly_contribution=item.yearly_value / 12,
                    annual_increase_percent=item.annual_increase_percent if item.is_income else item.inflation_percent,
                    annual_change_type='increase' if item.is_income else 'decrease'
                )
            else:
                print(f"DEBUG (custom_charts.py): CashFlowItem with ID {item_id} not found for user {current_user.id}")
        return None

    for series_config in series_configs:
        item_type = series_config.get('data_type')
        item_id = series_config.get('item_id') # Assuming item_id is passed in series_configurations

        if item_type and item_id:
            account = fetch_and_convert_item(item_type, item_id)
            if account:
                accounts_for_projection.append(account)
            else:
                print(f"WARNING (custom_charts.py): Could not find item {item_id} of type {item_type} for user {current_user.id}")
        else:
            print(f"WARNING (custom_charts.py): Invalid series config: {series_config}")

    print(f"DEBUG (custom_charts.py): Accounts prepared for projection: {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)}")

    # 2. Call calculate_projection
    try:
        projection_results = calculations.calculate_projection(
            years=projection_years,
            accounts=[acc.model_dump() for acc in accounts_for_projection],
            db=db,
            owner_id=current_user.id
        )
        print(f"DEBUG (custom_charts.py): Projection calculation successful. Final Value: {projection_results['final_value']}")
    except Exception as e:
        print(f"ERROR (custom_charts.py): Error during projection calculation for chart {chart.name}: {e}")
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
    print(f"DEBUG (custom_charts.py): Custom chart {db_chart.name} created with ID {db_chart.id} and projection results.")
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
    print(f"DEBUG (custom_charts.py): Entering update_custom_chart for chart ID {chart_id}, user {current_user.id}")

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
        
        print(f"DEBUG (custom_charts.py): Parsed series configurations for update: {series_configs}")

        def fetch_and_convert_item(item_type: str, item_id: int):
            if item_type == 'asset':
                item = db.query(models.Asset).filter(models.Asset.id == item_id, models.Asset.owner_id == current_user.id).first()
                if item:
                    return schemas.AccountSchema(
                        name=item.name,
                        type='asset',
                        initial_balance=item.value,
                        monthly_contribution=0.0,
                        annual_increase_percent=item.annual_increase_percent,
                        annual_change_type=item.annual_change_type
                    )
            elif item_type == 'liability':
                item = db.query(models.Liability).filter(models.Liability.id == item_id, models.Liability.owner_id == current_user.id).first()
                if item:
                    return schemas.AccountSchema(
                        name=item.name,
                        type='liability',
                        initial_balance=item.value,
                        monthly_contribution=0.0,
                        annual_increase_percent=item.annual_increase_percent,
                        annual_change_type=item.annual_change_type
                    )
            elif item_type in ['income', 'expense']:
                item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
                if item:
                    return schemas.AccountSchema(
                        name=item.description,
                        type='income' if item.is_income else 'expense',
                        initial_balance=0.0,
                        monthly_contribution=item.yearly_value / 12,
                        annual_increase_percent=item.annual_increase_percent if item.is_income else item.inflation_percent,
                        annual_change_type='increase' if item.is_income else 'decrease'
                    )
            return None

        for series_config in series_configs:
            item_type = series_config.get('data_type')
            item_id = series_config.get('item_id')
            if item_type and item_id:
                account = fetch_and_convert_item(item_type, item_id)
                if account:
                    accounts_for_projection.append(account)
                else:
                    print(f"WARNING (custom_charts.py): Could not find item {item_id} of type {item_type} for user {current_user.id} during chart update.")

        print(f"DEBUG (custom_charts.py): Accounts prepared for projection update: {json.dumps([acc.model_dump() for acc in accounts_for_projection], indent=2)}")

        try:
            projection_results = calculations.calculate_projection(
                years=projection_years,
                accounts=[acc.model_dump() for acc in accounts_for_projection],
                db=db,
                owner_id=current_user.id
            )
            print(f"DEBUG (custom_charts.py): Projection calculation successful for chart update. Final Value: {projection_results['final_value']}")
            db_chart.data_json = projection_results["data_json"]
            db_chart.final_value = projection_results["final_value"]
            db_chart.total_contributed = projection_results["total_contributed"]
            db_chart.total_growth = projection_results["total_growth"]
        except Exception as e:
            print(f"ERROR (custom_charts.py): Error during projection calculation for chart update {db_chart.name}: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Projection calculation failed during update: {e}")

    # Update other fields from chart_update payload
    update_data = chart_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key not in ["data_json", "final_value", "total_contributed", "total_growth"]:
            setattr(db_chart, key, value)

    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    print(f"DEBUG (custom_charts.py): Custom chart {db_chart.name} (ID: {db_chart.id}) updated with projection results.")
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

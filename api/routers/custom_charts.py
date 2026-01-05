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
            # Contributions from expenses are now handled by backend calculations.py
            return schemas.ProjectedAccountCreate(
                name=item.name,
                account_type='asset',
                initial_value=item.value,
                contribution=0.0,  # Contributions from expenses are now handled by backend
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
            # For dynamic items (linked to asset), contribution will be recalculated each year in projection
            # Store initial contribution as 0 for dynamic items - it will be recalculated based on linked asset
            contribution = 0.0
            if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                # This is a dynamic item - contribution will be recalculated each year
                # For now, set to 0 - the projection calculation will handle the recalculation
                linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                if linked_asset:
                    # Store linked asset name in account name with special marker for projection calculation
                    # Format: "ItemName|LINKED:AssetName|PERCENTAGE:10.0"
                    linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                    account_name = item.description + linked_marker
                    print(f"--- DEBUG: Dynamic item {item.description} linked to asset {linked_asset.name} with {item.percentage}% ---"); sys.stdout.flush()
                else:
                    account_name = item.description
            else:
                account_name = item.description
                contribution = item.yearly_value / 12 if is_income_item else -(item.yearly_value / 12)
            
            return schemas.ProjectedAccountCreate(
                name=account_name,
                account_type=account_type,
                initial_value=0.0,
                contribution=contribution,
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
        # Track which accounts we've added to avoid duplicates
        added_account_names = set()
        # Track linked asset IDs needed by dynamic items
        linked_asset_ids_needed = set()
        
        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
        projection_years = user_settings.projection_years if user_settings else 30

        print(f"--- DEBUG: Parsed series configurations: {series_configs} ---"); sys.stdout.flush()
        print(f"--- DEBUG: Projection years from user settings: {projection_years} ---"); sys.stdout.flush()
        
        # First pass: Add all selected accounts and track dynamic items that need linked assets
        dynamic_items_needing_assets = []
        
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
                    # Clean account name (remove LINKED marker if present) before adding to set
                    clean_account_name = account.name.split("|LINKED:")[0] if "|LINKED:" in account.name else account.name
                    added_account_names.add(clean_account_name)
                    # If this is a dynamic cashflow item linked to an asset, track it
                    if item_type in ['income', 'expenses']:
                        item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
                        if item and item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset_ids_needed.add(item.linked_item_id)
                            print(f"--- DEBUG: Dynamic item {item.description} needs linked asset ID {item.linked_item_id} ---"); sys.stdout.flush()
                else:
                    print(f"--- WARNING: Could not find item {item_id} of type {item_type} for user {current_user.id} ---"); sys.stdout.flush()
            elif item_type and item_id is None: # Aggregate type selected (e.g., "all income" or "all items in a category")
                # Get selected account IDs from series config
                selected_account_ids = series_config.get('selected_account_ids', [])
                if isinstance(selected_account_ids, str):
                    try:
                        selected_account_ids = json.loads(selected_account_ids) if selected_account_ids else []
                    except:
                        selected_account_ids = []
                
                if item_type == 'assets':
                    query = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id)
                    if category:  # Filter by category if specified
                        query = query.filter(models.Asset.category == category)
                    if selected_account_ids:  # Filter by account if specified
                        query = query.filter(models.Asset.account_id.in_(selected_account_ids))
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
                        # Handle dynamic items (linked to asset)
                        contribution = 0.0
                        account_name = item.description
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                            if linked_asset:
                                linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                                account_name = item.description + linked_marker
                                linked_asset_ids_needed.add(item.linked_item_id)
                        else:
                            contribution = item.yearly_value / 12
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=account_name,
                            account_type='income',
                            initial_value=0.0,
                            contribution=contribution,
                            growth_rate=item.annual_increase_percent,
                        ))
                        added_account_names.add(account_name.split("|LINKED:")[0] if "|LINKED:" in account_name else account_name)
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
                        # Handle dynamic items (linked to asset)
                        contribution = 0.0
                        account_name = item.description
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                            if linked_asset:
                                linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                                account_name = item.description + linked_marker
                        else:
                            contribution = -(item.yearly_value / 12)
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=account_name,
                            account_type='expense',
                            initial_value=0.0,
                            contribution=contribution,
                            growth_rate=item.inflation_percent,
                        ))
                        added_account_names.add(account_name.split("|LINKED:")[0] if "|LINKED:" in account_name else account_name)
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset_ids_needed.add(item.linked_item_id)
                else:
                    print(f"--- WARNING: Unsupported aggregate item type: {item_type} for user {current_user.id} ---"); sys.stdout.flush()
            else:
                print(f"--- WARNING: Invalid series config: {series_config} ---"); sys.stdout.flush()

        # Auto-include any linked assets that are needed by dynamic items but not already in projection
        for linked_asset_id in linked_asset_ids_needed:
            linked_asset = db.query(models.Asset).filter(models.Asset.id == linked_asset_id, models.Asset.owner_id == current_user.id).first()
            if linked_asset and linked_asset.name not in added_account_names:
                print(f"--- DEBUG: Auto-including linked asset '{linked_asset.name}' (ID: {linked_asset_id}) for dynamic item calculation ---"); sys.stdout.flush()
                asset_account = schemas.ProjectedAccountCreate(
                    name=linked_asset.name,
                    account_type='asset',
                    initial_value=linked_asset.value,
                    contribution=0.0,  # Contributions from expenses are now handled by backend
                    growth_rate=linked_asset.annual_increase_percent,
                    loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                )
                accounts_for_projection.append(asset_account)
                added_account_names.add(linked_asset.name)

        # Auto-include ALL income and expense items for accurate calculations (surplus/deficit, auto-disbursements, expense contributions)
        # Check which income/expense items are already included
        included_income_names = set()
        included_expense_names = set()
        for acc in accounts_for_projection:
            if acc.account_type == "income":
                base_name = acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name
                included_income_names.add(base_name)
            elif acc.account_type == "expense":
                base_name = acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name
                included_expense_names.add(base_name)
        
        # Add all income items not already included
        all_income_items = db.query(models.CashFlowItem).filter(
            models.CashFlowItem.owner_id == current_user.id,
            models.CashFlowItem.is_income == True
        ).all()
        for item in all_income_items:
            if item.description not in included_income_names:
                print(f"--- DEBUG: Auto-including income item '{item.description}' for accurate calculations ---"); sys.stdout.flush()
                contribution = 0.0
                account_name = item.description
                if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                    linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                    if linked_asset:
                        linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                        account_name = item.description + linked_marker
                        if linked_asset.name not in added_account_names:
                            # Auto-include the linked asset if not already included
                            asset_account = schemas.ProjectedAccountCreate(
                                name=linked_asset.name,
                                account_type='asset',
                                initial_value=linked_asset.value,
                                contribution=0.0,
                                growth_rate=linked_asset.annual_increase_percent,
                                loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                            )
                            accounts_for_projection.append(asset_account)
                            added_account_names.add(linked_asset.name)
                else:
                    contribution = item.yearly_value / 12
                accounts_for_projection.append(schemas.ProjectedAccountCreate(
                    name=account_name,
                    account_type='income',
                    initial_value=0.0,
                    contribution=contribution,
                    growth_rate=item.annual_increase_percent,
                ))
                included_income_names.add(item.description)
        
        # Add all expense items not already included
        all_expense_items = db.query(models.CashFlowItem).filter(
            models.CashFlowItem.owner_id == current_user.id,
            models.CashFlowItem.is_income == False
        ).all()
        for item in all_expense_items:
            if item.description not in included_expense_names:
                print(f"--- DEBUG: Auto-including expense item '{item.description}' for accurate calculations ---"); sys.stdout.flush()
                contribution = 0.0
                account_name = item.description
                if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                    linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                    if linked_asset:
                        linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                        account_name = item.description + linked_marker
                        if linked_asset.name not in added_account_names:
                            # Auto-include the linked asset if not already included
                            asset_account = schemas.ProjectedAccountCreate(
                                name=linked_asset.name,
                                account_type='asset',
                                initial_value=linked_asset.value,
                                contribution=0.0,
                                growth_rate=linked_asset.annual_increase_percent,
                                loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                            )
                            accounts_for_projection.append(asset_account)
                            added_account_names.add(linked_asset.name)
                else:
                    contribution = -(item.yearly_value / 12)
                accounts_for_projection.append(schemas.ProjectedAccountCreate(
                    name=account_name,
                    account_type='expense',
                    initial_value=0.0,
                    contribution=contribution,
                    growth_rate=item.inflation_percent,
                ))
                included_expense_names.add(item.description)
        
        # Auto-include assets referenced in auto-disbursements (so transfers work correctly)
        auto_disbursements = db.query(models.AutoDisbursement).filter(
            models.AutoDisbursement.owner_id == current_user.id
        ).all()
        for disbursement in auto_disbursements:
            source_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.source_asset_id).first()
            target_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.target_asset_id).first()
            if source_asset and source_asset.name not in added_account_names:
                print(f"--- DEBUG: Auto-including source asset '{source_asset.name}' from auto-disbursement '{disbursement.name}' ---"); sys.stdout.flush()
                asset_account = schemas.ProjectedAccountCreate(
                    name=source_asset.name,
                    account_type='asset',
                    initial_value=source_asset.value,
                    contribution=0.0,
                    growth_rate=source_asset.annual_increase_percent,
                    loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                )
                accounts_for_projection.append(asset_account)
                added_account_names.add(source_asset.name)
            if target_asset and target_asset.name not in added_account_names:
                print(f"--- DEBUG: Auto-including target asset '{target_asset.name}' from auto-disbursement '{disbursement.name}' ---"); sys.stdout.flush()
                asset_account = schemas.ProjectedAccountCreate(
                    name=target_asset.name,
                    account_type='asset',
                    initial_value=target_asset.value,
                    contribution=0.0,
                    growth_rate=target_asset.annual_increase_percent,
                    loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                )
                accounts_for_projection.append(asset_account)
                added_account_names.add(target_asset.name)

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
    """
    Retrieve a custom chart by ID.
    
    Note: Charts use cached projection data (data_json). If underlying data (assets, liabilities, 
    income, expenses) is updated, the chart will not automatically reflect these changes. 
    Users must update or recreate the chart to see updated projections.
    """
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
        # Track which accounts we've added to avoid duplicates
        added_account_names = set()
        # Track linked asset IDs needed by dynamic items
        linked_asset_ids_needed = set()

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
                    added_account_names.add(account.name.split("|LINKED:")[0] if "|LINKED:" in account.name else account.name)
                    # If this is a dynamic cashflow item linked to an asset, track the linked asset ID
                    if item_type in ['income', 'expenses']:
                        item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
                        if item and item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset_ids_needed.add(item.linked_item_id)
                            print(f"--- DEBUG: Dynamic item {item.description} needs linked asset ID {item.linked_item_id} ---"); sys.stdout.flush()
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
                        added_account_names.add(item.name)
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
                        # Handle dynamic items (linked to asset)
                        contribution = 0.0
                        account_name = item.description
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                            if linked_asset:
                                linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                                account_name = item.description + linked_marker
                        else:
                            contribution = item.yearly_value / 12
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=account_name,
                            account_type='income',
                            initial_value=0.0,
                            contribution=contribution,
                            growth_rate=item.annual_increase_percent,
                        ))
                        added_account_names.add(account_name.split("|LINKED:")[0] if "|LINKED:" in account_name else account_name)
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset_ids_needed.add(item.linked_item_id)
                elif item_type == 'expenses':
                    query = db.query(models.CashFlowItem).filter(
                        models.CashFlowItem.is_income == False,
                        models.CashFlowItem.owner_id == current_user.id
                    )
                    if category:  # Filter by category if specified
                        query = query.filter(models.CashFlowItem.category == category)
                    items = query.all()
                    for item in items:
                        # Handle dynamic items (linked to asset)
                        contribution = 0.0
                        account_name = item.description
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                            if linked_asset:
                                linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                                account_name = item.description + linked_marker
                        else:
                            contribution = -(item.yearly_value / 12)
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=account_name,
                            account_type='expense',
                            initial_value=0.0,
                            contribution=contribution,
                            growth_rate=item.inflation_percent,
                        ))
                        added_account_names.add(account_name.split("|LINKED:")[0] if "|LINKED:" in account_name else account_name)
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset_ids_needed.add(item.linked_item_id)
                else:
                    print(f"--- WARNING: Unsupported aggregate item type: {item_type} for user {current_user.id} ---"); sys.stdout.flush()
            else:
                print(f"--- WARNING: Invalid series config: {series_config} ---"); sys.stdout.flush()

        # Auto-include any linked assets that are needed by dynamic items but not already in projection
        for linked_asset_id in linked_asset_ids_needed:
            linked_asset = db.query(models.Asset).filter(models.Asset.id == linked_asset_id, models.Asset.owner_id == current_user.id).first()
            if linked_asset and linked_asset.name not in added_account_names:
                print(f"--- DEBUG: Auto-including linked asset '{linked_asset.name}' (ID: {linked_asset_id}) for dynamic item calculation ---"); sys.stdout.flush()
                asset_account = schemas.ProjectedAccountCreate(
                    name=linked_asset.name,
                    account_type='asset',
                    initial_value=linked_asset.value,
                    contribution=0.0,  # Contributions from expenses are now handled by backend
                    growth_rate=linked_asset.annual_increase_percent,
                    loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                )
                accounts_for_projection.append(asset_account)
                added_account_names.add(linked_asset.name)

        # Auto-include ALL income and expense items for accurate calculations (surplus/deficit, auto-disbursements, expense contributions)
        # Check which income/expense items are already included
        included_income_names = set()
        included_expense_names = set()
        for acc in accounts_for_projection:
            if acc.account_type == "income":
                base_name = acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name
                included_income_names.add(base_name)
            elif acc.account_type == "expense":
                base_name = acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name
                included_expense_names.add(base_name)
        
        # Add all income items not already included
        all_income_items = db.query(models.CashFlowItem).filter(
            models.CashFlowItem.owner_id == current_user.id,
            models.CashFlowItem.is_income == True
        ).all()
        for item in all_income_items:
            if item.description not in included_income_names:
                print(f"--- DEBUG: Auto-including income item '{item.description}' for accurate calculations (update) ---"); sys.stdout.flush()
                contribution = 0.0
                account_name = item.description
                if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                    linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                    if linked_asset:
                        linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                        account_name = item.description + linked_marker
                        if linked_asset.name not in added_account_names:
                            # Auto-include the linked asset if not already included
                            asset_account = schemas.ProjectedAccountCreate(
                                name=linked_asset.name,
                                account_type='asset',
                                initial_value=linked_asset.value,
                                contribution=0.0,
                                growth_rate=linked_asset.annual_increase_percent,
                                loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                            )
                            accounts_for_projection.append(asset_account)
                            added_account_names.add(linked_asset.name)
                else:
                    contribution = item.yearly_value / 12
                accounts_for_projection.append(schemas.ProjectedAccountCreate(
                    name=account_name,
                    account_type='income',
                    initial_value=0.0,
                    contribution=contribution,
                    growth_rate=item.annual_increase_percent,
                ))
                included_income_names.add(item.description)
        
        # Add all expense items not already included
        all_expense_items = db.query(models.CashFlowItem).filter(
            models.CashFlowItem.owner_id == current_user.id,
            models.CashFlowItem.is_income == False
        ).all()
        for item in all_expense_items:
            if item.description not in included_expense_names:
                print(f"--- DEBUG: Auto-including expense item '{item.description}' for accurate calculations (update) ---"); sys.stdout.flush()
                contribution = 0.0
                account_name = item.description
                if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                    linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                    if linked_asset:
                        linked_marker = f"|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                        account_name = item.description + linked_marker
                        if linked_asset.name not in added_account_names:
                            # Auto-include the linked asset if not already included
                            asset_account = schemas.ProjectedAccountCreate(
                                name=linked_asset.name,
                                account_type='asset',
                                initial_value=linked_asset.value,
                                contribution=0.0,
                                growth_rate=linked_asset.annual_increase_percent,
                                loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                            )
                            accounts_for_projection.append(asset_account)
                            added_account_names.add(linked_asset.name)
                else:
                    contribution = -(item.yearly_value / 12)
                accounts_for_projection.append(schemas.ProjectedAccountCreate(
                    name=account_name,
                    account_type='expense',
                    initial_value=0.0,
                    contribution=contribution,
                    growth_rate=item.inflation_percent,
                ))
                included_expense_names.add(item.description)
        
        # Auto-include assets referenced in auto-disbursements (so transfers work correctly)
        auto_disbursements = db.query(models.AutoDisbursement).filter(
            models.AutoDisbursement.owner_id == current_user.id
        ).all()
        for disbursement in auto_disbursements:
            source_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.source_asset_id).first()
            target_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.target_asset_id).first()
            if source_asset and source_asset.name not in added_account_names:
                print(f"--- DEBUG: Auto-including source asset '{source_asset.name}' from auto-disbursement '{disbursement.name}' (update) ---"); sys.stdout.flush()
                asset_account = schemas.ProjectedAccountCreate(
                    name=source_asset.name,
                    account_type='asset',
                    initial_value=source_asset.value,
                    contribution=0.0,
                    growth_rate=source_asset.annual_increase_percent,
                    loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                )
                accounts_for_projection.append(asset_account)
                added_account_names.add(source_asset.name)
            if target_asset and target_asset.name not in added_account_names:
                print(f"--- DEBUG: Auto-including target asset '{target_asset.name}' from auto-disbursement '{disbursement.name}' (update) ---"); sys.stdout.flush()
                asset_account = schemas.ProjectedAccountCreate(
                    name=target_asset.name,
                    account_type='asset',
                    initial_value=target_asset.value,
                    contribution=0.0,
                    growth_rate=target_asset.annual_increase_percent,
                    loan_type=None, principal_amount=None, interest_rate=None, loan_term_months=None, loan_start_date=None, monthly_payment=None
                )
                accounts_for_projection.append(asset_account)
                added_account_names.add(target_asset.name)

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

@router.post("/recalculate-all", response_model=dict, tags=["Custom Charts"])
def recalculate_all_charts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Recalculates projection data for all custom charts for the current user.
    This updates data_json, final_value, total_contributed, and total_growth for each chart
    based on current underlying data (assets, liabilities, income, expenses).
    """
    print(f"--- DEBUG: Entering recalculate_all_charts for user {current_user.id} ---"); sys.stdout.flush()
    
    charts = db.query(models.CustomChart).filter(models.CustomChart.user_id == current_user.id).all()
    recalculated_count = 0
    errors = []
    
    for db_chart in charts:
        try:
            # Recalculate by calling update_custom_chart with empty update (just to trigger recalculation)
            # We'll pass the chart's existing series_configurations to trigger recalculation
            from schemas import CustomChartUpdate
            chart_update = CustomChartUpdate(series_configurations=db_chart.series_configurations)
            
            # Call the recalculation logic from update_custom_chart
            # We'll reuse the logic by directly updating the chart
            if db_chart.series_configurations:
                series_configs = json.loads(db_chart.series_configurations)
                accounts_for_projection = []
                added_account_names = set()
                linked_asset_ids_needed = set()
                
                user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
                projection_years = user_settings.projection_years if user_settings else 30
                
                # Build accounts_for_projection (reusing logic from update_custom_chart)
                # This is a simplified version - in production, extract this to a helper function
                # For now, we'll use the same logic inline
                for series_config in series_configs:
                    item_type = series_config.get('data_type')
                    item_id = series_config.get('item_id') or series_config.get('selected_item_id')
                    if item_id == "" or item_id == 0:
                        item_id = None
                    elif item_id is not None:
                        try:
                            item_id = int(item_id)
                        except (ValueError, TypeError):
                            continue
                    category = series_config.get('category')
                    
                    if item_type and item_id:
                        account = fetch_and_convert_item(db, current_user, item_type, item_id)
                        if account:
                            accounts_for_projection.append(account)
                            added_account_names.add(account.name.split("|LINKED:")[0] if "|LINKED:" in account.name else account.name)
                            if item_type in ['income', 'expenses']:
                                item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id, models.CashFlowItem.owner_id == current_user.id).first()
                                if item and item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                                    linked_asset_ids_needed.add(item.linked_item_id)
                    elif item_type and item_id is None:
                        # Aggregate logic (simplified - see update_custom_chart for full implementation)
                        if item_type == 'assets':
                            query = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id)
                            if category:
                                query = query.filter(models.Asset.category == category)
                            items = query.all()
                            for item in items:
                                accounts_for_projection.append(schemas.ProjectedAccountCreate(
                                    name=item.name, account_type='asset', initial_value=item.value,
                                    contribution=0.0, growth_rate=item.annual_increase_percent,
                                    loan_type=None, principal_amount=None, interest_rate=None,
                                    loan_term_months=None, loan_start_date=None, monthly_payment=None
                                ))
                                added_account_names.add(item.name)
                        elif item_type == 'liabilities':
                            query = db.query(models.Liability).filter(models.Liability.owner_id == current_user.id)
                            if category:
                                query = query.filter(models.Liability.category == category)
                            items = query.all()
                            for item in items:
                                accounts_for_projection.append(schemas.ProjectedAccountCreate(
                                    name=item.name, account_type='liability', initial_value=-abs(item.value),
                                    contribution=0.0, growth_rate=item.annual_increase_percent,
                                    loan_type=item.loan_type, principal_amount=item.principal_amount,
                                    interest_rate=item.interest_rate, loan_term_months=item.loan_term_months,
                                    loan_start_date=item.loan_start_date, monthly_payment=item.monthly_payment
                                ))
                                added_account_names.add(item.name)
                        elif item_type == 'income':
                            query = db.query(models.CashFlowItem).filter(
                                models.CashFlowItem.owner_id == current_user.id,
                                models.CashFlowItem.is_income == True
                            )
                            if category:
                                query = query.filter(models.CashFlowItem.category == category)
                            items = query.all()
                            for item in items:
                                contribution = 0.0
                                account_name = item.description
                                if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                                    linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                                    if linked_asset:
                                        account_name = f"{item.description}|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                                        linked_asset_ids_needed.add(item.linked_item_id)
                                else:
                                    contribution = item.yearly_value / 12
                                accounts_for_projection.append(schemas.ProjectedAccountCreate(
                                    name=account_name, account_type='income', initial_value=0.0,
                                    contribution=contribution, growth_rate=item.annual_increase_percent,
                                    loan_type=None, principal_amount=None, interest_rate=None,
                                    loan_term_months=None, loan_start_date=None, monthly_payment=None
                                ))
                                added_account_names.add(account_name.split("|LINKED:")[0] if "|LINKED:" in account_name else account_name)
                        elif item_type == 'expenses':
                            query = db.query(models.CashFlowItem).filter(
                                models.CashFlowItem.is_income == False,
                                models.CashFlowItem.owner_id == current_user.id
                            )
                            if category:
                                query = query.filter(models.CashFlowItem.category == category)
                            items = query.all()
                            for item in items:
                                contribution = 0.0
                                account_name = item.description
                                if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                                    linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                                    if linked_asset:
                                        account_name = f"{item.description}|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                                        linked_asset_ids_needed.add(item.linked_item_id)
                                else:
                                    contribution = -(item.yearly_value / 12)
                                accounts_for_projection.append(schemas.ProjectedAccountCreate(
                                    name=account_name, account_type='expense', initial_value=0.0,
                                    contribution=contribution, growth_rate=item.inflation_percent,
                                    loan_type=None, principal_amount=None, interest_rate=None,
                                    loan_term_months=None, loan_start_date=None, monthly_payment=None
                                ))
                                added_account_names.add(account_name.split("|LINKED:")[0] if "|LINKED:" in account_name else account_name)
                
                # Auto-include linked assets
                for linked_asset_id in linked_asset_ids_needed:
                    linked_asset = db.query(models.Asset).filter(models.Asset.id == linked_asset_id, models.Asset.owner_id == current_user.id).first()
                    if linked_asset and linked_asset.name not in added_account_names:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=linked_asset.name, account_type='asset', initial_value=linked_asset.value,
                            contribution=0.0, growth_rate=linked_asset.annual_increase_percent,
                            loan_type=None, principal_amount=None, interest_rate=None,
                            loan_term_months=None, loan_start_date=None, monthly_payment=None
                        ))
                        added_account_names.add(linked_asset.name)
                
                # Auto-include ALL income and expense items (simplified - see update_custom_chart for full logic)
                included_income_names = {acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name 
                                        for acc in accounts_for_projection if acc.account_type == "income"}
                included_expense_names = {acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name 
                                         for acc in accounts_for_projection if acc.account_type == "expense"}
                
                all_income_items = db.query(models.CashFlowItem).filter(
                    models.CashFlowItem.owner_id == current_user.id,
                    models.CashFlowItem.is_income == True
                ).all()
                for item in all_income_items:
                    if item.description not in included_income_names:
                        contribution = 0.0
                        account_name = item.description
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                            if linked_asset:
                                account_name = f"{item.description}|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                                if linked_asset.name not in added_account_names:
                                    accounts_for_projection.append(schemas.ProjectedAccountCreate(
                                        name=linked_asset.name, account_type='asset', initial_value=linked_asset.value,
                                        contribution=0.0, growth_rate=linked_asset.annual_increase_percent,
                                        loan_type=None, principal_amount=None, interest_rate=None,
                                        loan_term_months=None, loan_start_date=None, monthly_payment=None
                                    ))
                                    added_account_names.add(linked_asset.name)
                        else:
                            contribution = item.yearly_value / 12
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=account_name, account_type='income', initial_value=0.0,
                            contribution=contribution, growth_rate=item.annual_increase_percent,
                            loan_type=None, principal_amount=None, interest_rate=None,
                            loan_term_months=None, loan_start_date=None, monthly_payment=None
                        ))
                        included_income_names.add(item.description)
                
                all_expense_items = db.query(models.CashFlowItem).filter(
                    models.CashFlowItem.owner_id == current_user.id,
                    models.CashFlowItem.is_income == False
                ).all()
                for item in all_expense_items:
                    if item.description not in included_expense_names:
                        contribution = 0.0
                        account_name = item.description
                        if item.linked_item_id and item.linked_item_type == "asset" and item.percentage is not None:
                            linked_asset = db.query(models.Asset).filter(models.Asset.id == item.linked_item_id).first()
                            if linked_asset:
                                account_name = f"{item.description}|LINKED:{linked_asset.name}|PERCENTAGE:{item.percentage}"
                                if linked_asset.name not in added_account_names:
                                    accounts_for_projection.append(schemas.ProjectedAccountCreate(
                                        name=linked_asset.name, account_type='asset', initial_value=linked_asset.value,
                                        contribution=0.0, growth_rate=linked_asset.annual_increase_percent,
                                        loan_type=None, principal_amount=None, interest_rate=None,
                                        loan_term_months=None, loan_start_date=None, monthly_payment=None
                                    ))
                                    added_account_names.add(linked_asset.name)
                        else:
                            contribution = -(item.yearly_value / 12)
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=account_name, account_type='expense', initial_value=0.0,
                            contribution=contribution, growth_rate=item.inflation_percent,
                            loan_type=None, principal_amount=None, interest_rate=None,
                            loan_term_months=None, loan_start_date=None, monthly_payment=None
                        ))
                        included_expense_names.add(item.description)
                
                # Auto-include assets from auto-disbursements
                auto_disbursements = db.query(models.AutoDisbursement).filter(
                    models.AutoDisbursement.owner_id == current_user.id
                ).all()
                for disbursement in auto_disbursements:
                    source_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.source_asset_id).first()
                    target_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.target_asset_id).first()
                    if source_asset and source_asset.name not in added_account_names:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=source_asset.name, account_type='asset', initial_value=source_asset.value,
                            contribution=0.0, growth_rate=source_asset.annual_increase_percent,
                            loan_type=None, principal_amount=None, interest_rate=None,
                            loan_term_months=None, loan_start_date=None, monthly_payment=None
                        ))
                        added_account_names.add(source_asset.name)
                    if target_asset and target_asset.name not in added_account_names:
                        accounts_for_projection.append(schemas.ProjectedAccountCreate(
                            name=target_asset.name, account_type='asset', initial_value=target_asset.value,
                            contribution=0.0, growth_rate=target_asset.annual_increase_percent,
                            loan_type=None, principal_amount=None, interest_rate=None,
                            loan_term_months=None, loan_start_date=None, monthly_payment=None
                        ))
                        added_account_names.add(target_asset.name)
                
                # Recalculate projection
                import calculations
                projection_results = calculations.calculate_projection(
                    years=projection_years,
                    accounts=accounts_for_projection,
                    db=db,
                    owner_id=current_user.id
                )
                
                # Update chart
                db_chart.data_json = projection_results["data_json"]
                db_chart.final_value = projection_results["final_value"]
                db_chart.total_contributed = projection_results["total_contributed"]
                db_chart.total_growth = projection_results["total_growth"]
                db.add(db_chart)
                recalculated_count += 1
                print(f"--- DEBUG: Recalculated chart '{db_chart.name}' (ID: {db_chart.id}) ---"); sys.stdout.flush()
            else:
                print(f"--- WARNING: Chart '{db_chart.name}' (ID: {db_chart.id}) has no series_configurations, skipping ---"); sys.stdout.flush()
        except Exception as e:
            error_msg = f"Error recalculating chart '{db_chart.name}' (ID: {db_chart.id}): {str(e)}"
            print(f"--- ERROR: {error_msg} (Traceback: {traceback.format_exc()}) ---"); sys.stdout.flush()
            errors.append(error_msg)
    
    db.commit()
    print(f"--- DEBUG: Recalculated {recalculated_count} charts for user {current_user.id} ---"); sys.stdout.flush()
    
    return {
        "recalculated_count": recalculated_count,
        "total_charts": len(charts),
        "errors": errors
    }

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

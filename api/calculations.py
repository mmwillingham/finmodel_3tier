# api/calculations.py

import pandas as pd
import json
from typing import List, Optional
from sqlalchemy.orm import Session
import models # Adjust import for models

# Note: Assuming schemas and the ProjectionRequest model are accessible here
# from schemas import ProjectionRequest 

def calculate_projection(years: int, accounts: list, db: Session, owner_id: int) -> dict:
    """
    Calculates the financial projection, tracking balances for each account yearly.
    Includes dynamic calculation of cash flow items linked to other assets/income/expenses.
    """
    
    # 1. Fetch all relevant items for the owner
    all_assets = db.query(models.Asset).filter(models.Asset.owner_id == owner_id).all()
    all_liabilities = db.query(models.Liability).filter(models.Liability.owner_id == owner_id).all()
    all_cashflow_items = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == owner_id).all()

    # Create lookup dictionaries for quick access
    assets_by_id = {asset.id: asset for asset in all_assets}
    liabilities_by_id = {liability.id: liability for liability in all_liabilities}
    
    # Create a mutable copy of cashflow items to work with
    # Initialize a temporary yearly_value for all cashflow items based on their stored value
    # Dynamic items will have their yearly_value updated later
    processed_cashflow_items = []
    for item in all_cashflow_items:
        item_copy = item.__dict__.copy() # Create a mutable copy
        if not item_copy.get(\"linked_item_id\") and not item_copy.get(\"linked_item_type\") and item_copy.get(\"percentage\") is None:
            # For static items, yearly_value is already stored
            pass # No change needed, yearly_value is already loaded from DB
        else:
            # Mark dynamic items to be resolved
            item_copy[\"yearly_value\"] = 0.0 # Temporarily set to 0, will be calculated
        processed_cashflow_items.append(item_copy)

    # Convert to dictionary for easy lookup and modification
    cashflow_by_id = {item[\"id\"]: item for item in processed_cashflow_items}

    # 2. Iteratively resolve dynamic CashFlowItems
    # This loop will ensure that items dependent on other cashflow items are calculated
    # in the correct order. It will continue until no more items can be resolved in a pass.
    resolved_count = -1 # Initialize to -1 to enter the loop at least once
    max_passes = len(processed_cashflow_items) * 2 # Safety break for circular dependencies

    current_pass = 0
    while resolved_count != 0 and current_pass < max_passes:
        resolved_count = 0
        for item_dict in processed_cashflow_items:
            if item_dict.get(\"linked_item_id\") and item_dict.get(\"linked_item_type\") and item_dict.get(\"percentage\") is not None:
                # If yearly_value is already calculated, skip
                if item_dict[\"yearly_value\"] != 0.0:
                    continue

                linked_value = 0.0
                linked_item_resolved = False

                if item_dict[\"linked_item_type\"] == \'asset\' and item_dict[\"linked_item_id\"] in assets_by_id:
                    linked_value = assets_by_id[item_dict[\"linked_item_id\"]].value
                    linked_item_resolved = True
                elif item_dict[\"linked_item_type\"] == \'liability\' and item_dict[\"linked_item_id\"] in liabilities_by_id:
                    linked_value = liabilities_by_id[item_dict[\"linked_item_id\"]].value
                    linked_item_resolved = True
                elif item_dict[\"linked_item_type\"] == \'income\' and item_dict[\"linked_item_id\"] in cashflow_by_id:
                    # Check if the linked cashflow item's yearly_value is already resolved
                    linked_cf_item = cashflow_by_id.get(item_dict[\"linked_item_id\"])
                    if linked_cf_item and linked_cf_item[\"yearly_value\"] != 0.0:
                        linked_value = linked_cf_item[\"yearly_value\"]
                        linked_item_resolved = True
                elif item_dict[\"linked_item_type\"] == \'expense\' and item_dict[\"linked_item_id\"] in cashflow_by_id:
                    # Check if the linked cashflow item's yearly_value is already resolved
                    linked_cf_item = cashflow_by_id.get(item_dict[\"linked_item_id\"])
                    if linked_cf_item and linked_cf_item[\"yearly_value\"] != 0.0:
                        linked_value = linked_cf_item[\"yearly_value\"]
                        linked_item_resolved = True
                
                if linked_item_resolved:
                    item_dict[\"yearly_value\"] = linked_value * (item_dict[\"percentage\"] / 100.0)
                    resolved_count += 1
        current_pass += 1
        
    # After resolution, convert CashFlowItems to an account-like structure for projection
    final_cashflow_accounts = []
    for item_dict in processed_cashflow_items:
        final_cashflow_accounts.append({
            \"name\": item_dict[\"description\"], # Use description as name for projection clarity
            \"type\": \"income\" if item_dict[\"is_income\"] else \"expense\", # Treat as income/expense for cashflow
            \"initial_balance\": 0.0, # Cash flow items don\'t have an initial balance in this context
            \"monthly_contribution\": item_dict[\"yearly_value\"] / 12, # Always monthly equivalent
            \"annual_increase_percent\": item_dict[\"annual_increase_percent\"] if item_dict[\"is_income\"] else item_dict[\"inflation_percent\"],
            \"annual_change_type\": \"increase\" if item_dict[\"is_income\"] else \"decrease\", # Income increases, expense decreases
            \"id\": item_dict[\"id\"], # Keep original ID for potential future lookup
        })
    
    # Combine original accounts with processed cash flow items
    # Ensure \'accounts\' passed in are already Pydantic models or similar dicts
    # Convert incoming Pydantic AccountSchema objects to dicts for mutable list
    combined_accounts = [acc.model_dump() if hasattr(acc, \'model_dump\') else acc for acc in accounts]
    
    # Filter out cashflow_items that are already in `accounts` from `combined_accounts`
    # This scenario would happen if a cashflow item is sent by the frontend as part of `accounts`
    # We prioritize the dynamically calculated value, so we\'ll ensure no duplicates.
    existing_account_names = {acc[\"name\"] for acc in combined_accounts}
    for cf_acc in final_cashflow_accounts:
        if cf_acc[\"name\"] not in existing_account_names:
            combined_accounts.append(cf_acc)
            existing_account_names.add(cf_acc[\"name\"])

    # Initialize separate running balances for each account
    account_balances = {\
        acc[\"name\"]: acc[\"initial_balance\"] for acc in combined_accounts\
    }
    
    # Initialize data structures for results
    yearly_results = []
    total_contribution = 0.0
    total_growth = 0.0
    
    # Track previous year\'s ending value for StartingValue calculation
    previous_year_total_value = sum(acc[\"initial_balance\"] for acc in combined_accounts)

    # ----------------------------------------------------------------------
    # Main Projection Loop
    for year in range(1, years + 1):
        
        # Calculate starting value (previous year\'s ending value, or initial balances for year 1)
        starting_value = previous_year_total_value
        
        yearly_record = {\
            \"Year\": year, \
            \"StartingValue\": starting_value,\
        }
        current_year_total_value = 0.0
        year_total_contributions = 0.0
        year_total_growth = 0.0
        
        # 2. Loop through each account to calculate its growth
        for account in combined_accounts:
            current_balance = account_balances.get(account[\"name\"], 0.0) # Use .get for safety

            # --- CALCULATE GROWTH ---\
            # Determine the effective rate based on annual_change_type
            rate_from_schema = account.get(\'annual_increase_percent\', 0.0) / 100.0
            change_type = account.get(\'annual_change_type\', \'increase\')
            
            effective_rate = rate_from_schema
            if change_type == \"decrease\":
                effective_rate = -effective_rate
            
            # Adjust annual_contribution for liabilities/expenses: contributions decrease the balance
            # For cash flow items, monthly_contribution is already a yearly value if frequency was \"yearly\"
            monthly_contribution = account.get(\"monthly_contribution\", 0.0)
            adjusted_annual_contribution = monthly_contribution * 12 # This is where monthly is converted to yearly.
            
            if account[\"type\"] == \"liability\" or account[\"type\"] == \"expense\":
                adjusted_annual_contribution = -abs(adjusted_annual_contribution) # Contributions/expenses reduce balance
            elif account[\"type\"] == \"income\":
                adjusted_annual_contribution = abs(adjusted_annual_contribution) # Income adds to balance

            total_contribution += adjusted_annual_contribution
            year_total_contributions += adjusted_annual_contribution
            
            # Simple compounded growth
            growth_on_balance = current_balance * effective_rate 
            growth_on_contributions = adjusted_annual_contribution * effective_rate * 0.5 
            year_total_growth += growth_on_balance + growth_on_contributions
            
            # Update balance and add account value to record
            new_balance = current_balance + adjusted_annual_contribution + growth_on_balance + growth_on_contributions
            account_balances[account[\"name\"]] = new_balance
            yearly_record[f\"{account[\'name\']}_Value\"] = new_balance
            current_year_total_value += new_balance
        
        # Add totals to yearly record
        yearly_record[\"Total_Contribution\"] = year_total_contributions
        yearly_record[\"Total_Growth\"] = year_total_growth
        yearly_record[\"Total_Value\"] = current_year_total_value
        
        yearly_results.append(yearly_record)
        previous_year_total_value = current_year_total_value
    # ----------------------------------------------------------------------

    # 5. The final output structure (returned to the FastAPI endpoint)
    return {
        \"final_value\": yearly_results[-1][\"Total_Value\"] if yearly_results else 0.0,
        \"total_contributed\": total_contribution,\
        \"total_growth\": total_growth,\
        # Convert the list of dictionaries to a JSON string for data_json
        \"data_json\": json.dumps(yearly_results)\
    }

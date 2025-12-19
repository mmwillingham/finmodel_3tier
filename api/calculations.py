# api/calculations.py

import pandas as pd
import json
from typing import List, Optional
from sqlalchemy.orm import Session
from .. import models # Adjust import for models

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
    cashflow_by_id = {item.id: item for item in all_cashflow_items}

    # 2. Pre-process dynamic CashFlowItems: calculate initial yearly_value if linked
    processed_cashflow_accounts = []
    for item in all_cashflow_items:
        if item.linked_item_id and item.linked_item_type and item.percentage is not None:
            linked_value = 0.0
            if item.linked_item_type == 'asset' and item.linked_item_id in assets_by_id:
                linked_value = assets_by_id[item.linked_item_id].value
            elif item.linked_item_type == 'liability' and item.linked_item_id in liabilities_by_id:
                linked_value = liabilities_by_id[item.linked_item_id].value
            elif item.linked_item_type == 'income' and item.linked_item_id in cashflow_by_id:
                # Ensure the linked income item's value is already resolved if it itself is dynamic
                # For simplicity here, we assume direct links are sufficient for initial value.
                # A more robust solution might require a topological sort for deeply nested dependencies.
                linked_value = cashflow_by_id[item.linked_item_id].yearly_value
            elif item.linked_item_type == 'expense' and item.linked_item_id in cashflow_by_id:
                linked_value = cashflow_by_id[item.linked_item_id].yearly_value
            
            # Calculate dynamic yearly_value
            item.yearly_value = linked_value * (item.percentage / 100.0)
            
            # For linked items, the base value is dynamic, so original `value` from payload is ignored.
            # Convert to yearly for consistency if it was monthly in original payload
            # This is already handled in the API endpoint's create/update logic (yearly_value = payload.value * 12 or payload.value)
            # So, we just use the calculated item.yearly_value
        
        # Convert CashFlowItem to an account-like structure for projection
        # For projection purposes, cash flow items are like annual contributions/withdrawals
        processed_cashflow_accounts.append({
            "name": item.description, # Use description as name for projection clarity
            "type": "income" if item.is_income else "expense", # Treat as income/expense for cashflow
            "initial_balance": 0.0, # Cash flow items don't have an initial balance in this context
            "monthly_contribution": item.yearly_value / 12,
            "annual_increase_percent": item.annual_increase_percent if item.is_income else item.inflation_percent,
            "annual_change_type": "increase" if item.is_income else "decrease", # Income increases, expense decreases
            "id": item.id, # Keep original ID for potential future lookup
        })
    
    # Combine original accounts with processed cash flow items
    # Ensure 'accounts' passed in are already Pydantic models or similar dicts
    # Convert incoming Pydantic AccountSchema objects to dicts for mutable list
    combined_accounts = [acc.model_dump() if hasattr(acc, 'model_dump') else acc for acc in accounts]
    
    # Filter out cashflow_items that are already in `accounts` from `combined_accounts`
    # This scenario would happen if a cashflow item is sent by the frontend as part of `accounts`
    # We prioritize the dynamically calculated value, so we'll ensure no duplicates.
    existing_account_names = {acc["name"] for acc in combined_accounts}
    for cf_acc in processed_cashflow_accounts:
        if cf_acc["name"] not in existing_account_names:
            combined_accounts.append(cf_acc)
            existing_account_names.add(cf_acc["name"])

    # Initialize separate running balances for each account
    account_balances = {
        acc["name"]: acc["initial_balance"] for acc in combined_accounts
    }
    
    # Initialize data structures for results
    yearly_results = []
    total_contribution = 0.0
    total_growth = 0.0
    
    # Track previous year's ending value for StartingValue calculation
    previous_year_total_value = sum(acc["initial_balance"] for acc in combined_accounts)

    # ----------------------------------------------------------------------
    # Main Projection Loop
    for year in range(1, years + 1):
        
        # Calculate starting value (previous year's ending value, or initial balances for year 1)
        starting_value = previous_year_total_value
        
        yearly_record = {
            "Year": year, 
            "StartingValue": starting_value,
        }
        current_year_total_value = 0.0
        year_total_contributions = 0.0
        year_total_growth = 0.0
        
        # 2. Loop through each account to calculate its growth
        for account in combined_accounts:
            current_balance = account_balances.get(account["name"], 0.0) # Use .get for safety

            # --- CALCULATE GROWTH ---
            # Determine the effective rate based on annual_change_type
            rate_from_schema = account.get('annual_increase_percent', 0.0) / 100.0
            change_type = account.get('annual_change_type', 'increase')
            
            effective_rate = rate_from_schema
            if change_type == "decrease":
                effective_rate = -effective_rate
            
            # Adjust annual_contribution for liabilities/expenses: contributions decrease the balance
            # For cash flow items, monthly_contribution is already a yearly value if frequency was "yearly"
            monthly_contribution = account.get("monthly_contribution", 0.0)
            adjusted_annual_contribution = monthly_contribution * 12 # This is where monthly is converted to yearly.
            
            if account["type"] == "liability" or account["type"] == "expense":
                adjusted_annual_contribution = -abs(adjusted_annual_contribution) # Contributions/expenses reduce balance
            elif account["type"] == "income":
                adjusted_annual_contribution = abs(adjusted_annual_contribution) # Income adds to balance

            total_contribution += adjusted_annual_contribution
            year_total_contributions += adjusted_annual_contribution
            
            # Simple compounded growth
            growth_on_balance = current_balance * effective_rate 
            growth_on_contributions = adjusted_annual_contribution * effective_rate * 0.5 
            year_total_growth += growth_on_balance + growth_on_contributions
            
            # Update balance and add account value to record
            new_balance = current_balance + adjusted_annual_contribution + growth_on_balance + growth_on_contributions
            account_balances[account["name"]] = new_balance
            yearly_record[f"{account['name']}_Value"] = new_balance
            current_year_total_value += new_balance
        
        # Add totals to yearly record
        yearly_record["Total_Contribution"] = year_total_contributions
        yearly_record["Total_Growth"] = year_total_growth
        yearly_record["Total_Value"] = current_year_total_value
        
        yearly_results.append(yearly_record)
        previous_year_total_value = current_year_total_value
    # ----------------------------------------------------------------------

    # 5. The final output structure (returned to the FastAPI endpoint)
    return {
        "final_value": yearly_results[-1]["Total_Value"] if yearly_results else 0.0,
        "total_contributed": total_contribution,
        "total_growth": total_growth,
        # Convert the list of dictionaries to a JSON string for data_json
        "data_json": json.dumps(yearly_results)
    }

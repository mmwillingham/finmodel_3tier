# api/calculations.py

import pandas as pd
from typing import List
# Note: Assuming schemas and the ProjectionRequest model are accessible here
from .schemas import ProjectionRequest 

# api/calculations.py

import json 
# ... other imports (e.g., AccountRequest model)

def calculate_projection(years: int, accounts: list) -> dict:
    """
    Calculates the financial projection, tracking balances for each account yearly.
    """
    
    # Initialize separate running balances for each account
    account_balances = {
        acc.name: acc.initial_balance for acc in accounts
    }
    
    # Initialize data structures for results
    yearly_results = []
    total_contribution = 0.0
    total_growth = 0.0
    
    # Track previous year's ending value for StartingValue calculation
    previous_year_total_value = sum(acc.initial_balance for acc in accounts)

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
        for account in accounts:
            current_balance = account_balances[account.name]
            
            # --- CALCULATE GROWTH ---
            rate = account.annual_rate_percent / 100.0
            annual_contribution = account.monthly_contribution * 12
            total_contribution += annual_contribution
            year_total_contributions += annual_contribution
            
            # Simple compounded growth
            growth_on_balance = current_balance * rate 
            growth_on_contributions = annual_contribution * rate * 0.5 
            year_total_growth += growth_on_balance + growth_on_contributions
            
            # Update balance and add account value to record
            new_balance = current_balance + annual_contribution + growth_on_balance + growth_on_contributions
            account_balances[account.name] = new_balance
            yearly_record[f"{account.name}_Value"] = new_balance
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

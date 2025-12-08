# financial_projector_api/calculations.py

import pandas as pd
from typing import List
# Note: Assuming schemas and the ProjectionRequest model are accessible here
from .schemas import ProjectionRequest 

# financial_projector_api/calculations.py

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

    # ----------------------------------------------------------------------
    # Main Projection Loop
    for year in range(1, years + 1):
        
        yearly_record = {"Year": year, "Total_Value": 0.0}
        current_year_total_value = 0.0
        
        # 2. Loop through each account to calculate its growth
        for account in accounts:
            current_balance = account_balances[account.name]
            
            # --- CALCULATE GROWTH ---
            rate = account.annual_rate_percent / 100.0
            annual_contribution = account.monthly_contribution * 12
            total_contribution += annual_contribution
            
            # Simple compounded growth (adjust formula if your model is different)
            # Growth on the balance held at the start of the year
            growth_on_balance = current_balance * rate 
            
            # Simplified growth assumption on contributions (half-year average)
            growth_on_contributions = annual_contribution * rate * 0.5 
            
            growth_amount = growth_on_balance + growth_on_contributions
            total_growth += growth_amount
            
            # --- UPDATE BALANCE ---
            new_balance = current_balance + annual_contribution + growth_amount
            account_balances[account.name] = new_balance
            
            # 3. Store the current account balance in the yearly record
            # CRITICAL: Use the account name as the key for the frontend
            yearly_record[f"{account.name}_Value"] = new_balance
            current_year_total_value += new_balance
            
        # 4. Finalize the record for the year
        yearly_record["Total_Value"] = current_year_total_value
        yearly_results.append(yearly_record)
    # ----------------------------------------------------------------------

    # 5. The final output structure (returned to the FastAPI endpoint)
    return {
        "final_value": yearly_results[-1]["Total_Value"] if yearly_results else 0.0,
        "total_contributed": total_contribution,
        "total_growth": total_growth,
        # Convert the list of dictionaries to a JSON string for data_json
        "data_json": json.dumps(yearly_results)
    }

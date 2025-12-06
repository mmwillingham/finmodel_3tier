import pandas as pd
import json

def calculate_future_value_dynamic(initial_balances: list, monthly_contributions: list, annual_rates_percent: list, years: int):
    """
    Calculates the future value for a dynamic number of accounts.
    Returns the final balance, total contributed, and a JSON-encoded string 
    containing the full projection (for storage).
    """
    
    num_accounts = len(initial_balances)
    rate_annual = [r / 100.0 for r in annual_rates_percent]
    rate_monthly = [r / 12 for r in rate_annual]
    total_months = years * 12
    
    # Use a list of lists to hold dynamic account balances over time
    account_balance_lists = [[] for _ in range(num_accounts)]
    
    total_portfolio_numeric = []
    year_list = []
    
    current_balances = list(initial_balances)
    total_contributed = sum(initial_balances)
    
    for month in range(1, total_months + 1):
        
        for i in range(num_accounts):
            current_balances[i] += monthly_contributions[i]
            total_contributed += monthly_contributions[i]
            current_balances[i] *= (1 + rate_monthly[i])
        
        if month % 12 == 0:
            year_list.append(month // 12)
            
            for i in range(num_accounts):
                account_balance_lists[i].append(current_balances[i])
            
            total_portfolio_numeric.append(sum(current_balances))
    
    # --- Prepare the Output Data ---
    
    # 1. Create dynamic column names for the internal DataFrame
    df_col_names_internal = [f'Account {i+1} Balance' for i in range(num_accounts)]
    
    data = {'Year': year_list}
    for i in range(num_accounts):
        data[df_col_names_internal[i]] = account_balance_lists[i]

    data['Total Projected Balance'] = total_portfolio_numeric
    
    # The final data structure to be stored and returned
    projection_data = {
        "final_value": total_portfolio_numeric[-1] if total_portfolio_numeric else 0.0,
        "total_contributed": total_contributed,
        "yearly_data": data
    }

    # Return the final value, total contributed, and the full projection data (as a JSON string)
    return projection_data["final_value"], total_contributed, json.dumps(projection_data)

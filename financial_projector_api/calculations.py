# financial_projector_api/calculations.py

import pandas as pd
from typing import List
# Note: Assuming schemas and the ProjectionRequest model are accessible here
from .schemas import ProjectionRequest 

def calculate_projection(projection_data: ProjectionRequest) -> pd.DataFrame:
    """
    Calculates a financial projection based on the list of accounts.
    """

    # 1. Aggregate Inputs from all accounts
    
    # Check for empty accounts list to avoid errors
    if not projection_data.accounts:
        # Return an empty dataframe if no accounts are provided
        return pd.DataFrame(columns=['Year', 'StartingValue', 'Contributions', 'Growth', 'Value'])

    # Aggregate initial capital and monthly contributions
    starting_capital = sum(acc.initial_balance for acc in projection_data.accounts)
    monthly_contribution = sum(acc.monthly_contribution for acc in projection_data.accounts)
    
    # CRITICAL: Determine a single weighted annual rate. 
    # For simplicity, we'll use the average rate of all accounts here.
    # In a real app, you'd use a weighted average based on initial_balance.
    total_rate_percent = sum(acc.annual_rate_percent for acc in projection_data.accounts)
    annual_rate_percent = total_rate_percent / len(projection_data.accounts)

    # Convert rate percentage to decimal
    annual_rate = annual_rate_percent / 100.0 
    
    # Get parameters
    years = projection_data.years
    
    # 2. Run the Core Calculation Logic

    data = []
    current_value = starting_capital
    
    for year in range(1, years + 1):
        starting_value = current_value
        
        # Calculate contributions for the year
        contributions_year = monthly_contribution * 12
        
        # Value before growth
        value_before_growth = starting_value + contributions_year
        
        # Simple compound interest growth on (start_value + contributions)
        # Note: A more precise calculation would compound monthly.
        growth = value_before_growth * annual_rate
        
        current_value = value_before_growth + growth
        
        data.append({
            'Year': year,
            'StartingValue': round(starting_value, 2),
            'Contributions': round(contributions_year, 2),
            'Growth': round(growth, 2),
            'Value': round(current_value, 2)
        })

    return pd.DataFrame(data)

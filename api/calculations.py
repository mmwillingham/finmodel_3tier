import json
import logging
import traceback
import sys
print(f"--- DEBUG: api/calculations.py LOADED ---"); sys.stdout.flush()

from typing import List, Optional
from sqlalchemy.orm import Session
import models
import schemas # Import schemas for type hinting
from datetime import date, datetime # Import datetime for parsing loan_start_date
from math import pow # NEW: For amortization calculation


logger = logging.getLogger(__name__)

def calculate_monthly_payment(
    principal: float,
    annual_interest_rate_percent: float,
    loan_term_months: int
) -> float:
    """
    Calculates the monthly payment for an amortized loan.

    Args:
        principal (float): The initial principal amount of the loan.
        annual_interest_rate_percent (float): The annual interest rate as a percentage (e.g., 5 for 5%).
        loan_term_months (int): The total term of the loan in months.

    Returns:
        float: The calculated monthly payment.
    """
    if annual_interest_rate_percent == 0:
        return principal / loan_term_months

    monthly_interest_rate = (annual_interest_rate_percent / 100) / 12
    
    # M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1]
    monthly_payment = (principal * monthly_interest_rate) / \
                      (1 - pow(1 + monthly_interest_rate, -loan_term_months))
    
    return monthly_payment

def calculate_amortized_loan_balance(
    principal: float,
    annual_interest_rate_percent: float,
    loan_term_months: int,
    loan_start_date: date,
    calculation_date: date
) -> float:
    """
    Calculates the remaining balance of an amortized loan at a given calculation date.

    Args:
        principal (float): The initial principal amount of the loan.
        annual_interest_rate_percent (float): The annual interest rate as a percentage (e.g., 5 for 5%).
        loan_term_months (int): The original term of the loan in months.
        loan_start_date (date): The date when the loan started.
        calculation_date (date): The date for which to calculate the remaining balance.

    Returns:
        float: The remaining loan balance. Returns 0 if the loan is paid off.
    """
    if annual_interest_rate_percent == 0:
        # Simple principal reduction for 0 interest
        months_passed = (calculation_date.year - loan_start_date.year) * 12 + \
                        (calculation_date.month - loan_start_date.month)
        if months_passed >= loan_term_months:
            return 0.0
        
        monthly_payment = principal / loan_term_months
        remaining_balance = principal - (monthly_payment * months_passed)
        return max(0.0, remaining_balance)

    monthly_interest_rate = (annual_interest_rate_percent / 100) / 12
    
    # Calculate monthly payment (M)
    # M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1]

    # P = Principal, i = monthly interest rate, n = total number of payments
    monthly_payment = (principal * monthly_interest_rate) / \
                      (1 - pow(1 + monthly_interest_rate, -loan_term_months))

    # Calculate number of payments made
    months_passed = (calculation_date.year - loan_start_date.year) * 12 + \
                    (calculation_date.month - loan_start_date.month)

    if months_passed <= 0:
        return principal
    if months_passed >= loan_term_months:
        return 0.0

    # Calculate remaining balance (B) after p payments
    # B = P(1+i)^p - M/i((1+i)^p - 1)
    remaining_balance = principal * pow(1 + monthly_interest_rate, months_passed) - \
                        (monthly_payment / monthly_interest_rate) * (pow(1 + monthly_interest_rate, months_passed) - 1)
    
    return max(0.0, remaining_balance)


def calculate_projection(years: int, accounts: List[schemas.ProjectedAccountCreate], db: Session, owner_id: int) -> dict:
    try:
        print(f"--- DEBUG: TOP OF calculate_projection function. Owner ID: {owner_id} ---"); sys.stdout.flush()
        print(f"--- DEBUG: ENTERED CALCULATIONS.PY: calculate_projection function for owner {owner_id} ---"); sys.stdout.flush()
        print(f"--- DEBUG: Accounts received by calculate_projection: {accounts} ---"); sys.stdout.flush() # NEW DEBUG

        # Initialize lists for new models
        projected_accounts_for_db: List[models.ProjectedAccount] = []
        time_series_data_for_db: List[models.ProjectionTimeSeriesData] = []

        # Prepare initial projected accounts based on input
        # These will be associated with the Projection after it's created and has an ID
        for acc_schema in accounts:
            print(f"--- DEBUG: Account Schema - Name: {acc_schema.name}, Type: {acc_schema.account_type}, Initial Value: {acc_schema.initial_value}, Contribution: {acc_schema.contribution}, Growth Rate: {acc_schema.growth_rate}, Loan Type: {acc_schema.loan_type}, Principal: {acc_schema.principal_amount}, Interest Rate: {acc_schema.interest_rate}, Loan Term: {acc_schema.loan_term_months}, Loan Start Date: {acc_schema.loan_start_date} ---"); sys.stdout.flush()
            projected_account = models.ProjectedAccount(
                name=acc_schema.name,
                account_type=acc_schema.account_type,
                initial_value=acc_schema.initial_value,
                contribution=acc_schema.contribution,
                growth_rate=acc_schema.growth_rate,
                # New fields for amortized loans
                loan_type=acc_schema.loan_type,
                principal_amount=acc_schema.principal_amount,
                interest_rate=acc_schema.interest_rate,
                loan_term_months=acc_schema.loan_term_months,
                loan_start_date=acc_schema.loan_start_date,
                monthly_payment=acc_schema.monthly_payment
                # projection_id will be set later
            )
            projected_accounts_for_db.append(projected_account)

        # Dictionary to hold current balances for each account, updated yearly
        # For income/expense items, initial_value is 0 (they don't have balances)
        account_current_balances = {acc.name: acc.initial_value for acc in projected_accounts_for_db}
        yearly_data_points = {} # NEW: Dictionary to build up data for data_json

        # Initialize global totals for the entire projection period
        total_contributed_overall = 0.0
        total_growth_overall = 0.0
        
        # Get current year for accurate loan balance calculations
        current_year = date.today().year

        # Main Projection Loop
        for year in range(1, years + 1):
            print(f"--- DEBUG: Starting projection for Year {year} ---"); sys.stdout.flush()

            # Yearly aggregates
            current_year_total_assets = 0.0
            current_year_total_liabilities = 0.0
            current_year_total_income_flow = 0.0
            current_year_total_expense_flow = 0.0
            current_year_contributions_sum = 0.0 # Sum of all contributions for this year
            current_year_growth_sum = 0.0 # Sum of all growth for this year

            for projected_account in projected_accounts_for_db:
                current_balance = account_current_balances[projected_account.name]
                
                # Special handling for amortized loans
                if projected_account.account_type == "liability" and projected_account.loan_type == "amortized" and projected_account.principal_amount is not None and projected_account.interest_rate is not None and projected_account.loan_term_months is not None and projected_account.loan_start_date is not None:
                    try:
                        loan_start_date_obj = datetime.strptime(projected_account.loan_start_date, "%Y-%m-%d").date()
                        calculation_date_obj = date(current_year + year -1, 12, 31) # End of current projection year
                        
                        remaining_principal = calculate_amortized_loan_balance(
                            principal=projected_account.principal_amount,
                            annual_interest_rate_percent=projected_account.interest_rate,
                            loan_term_months=projected_account.loan_term_months,
                            loan_start_date=loan_start_date_obj,
                            calculation_date=calculation_date_obj
                        )
                        # For liabilities, remaining_principal should be negative in our balance sheet
                        new_balance = -abs(remaining_principal)
                        
                        # For amortized loans, the 'contribution' is the monthly payment, which is handled in the balance calculation itself.
                        # The growth rate for a loan typically refers to the interest, which is also part of the amortization.
                        # So, we don't apply the general 'contribution' and 'growth_rate' logic for amortized loans here.
                        adjusted_annual_contribution = 0.0
                        growth_on_balance = 0.0
                        growth_on_contributions = 0.0
                        
                        # Update initial_value for next year's starting balance to be the remaining principal
                        # This ensures the amortization continues correctly
                        account_current_balances[projected_account.name] = new_balance

                    except ValueError:
                        print(f"--- DEBUG: Invalid loan_start_date format for {projected_account.name}. Skipping amortization calculation. (Traceback: {traceback.format_exc()}) ---"); sys.stdout.flush()
                        # Fallback to standard projection logic if date is invalid
                        new_balance = current_balance + (current_balance * (projected_account.growth_rate / 100.0)) + (projected_account.contribution * 12)
                        adjusted_annual_contribution = projected_account.contribution * 12
                        growth_on_balance = current_balance * (projected_account.growth_rate / 100.0)
                        growth_on_contributions = adjusted_annual_contribution * (projected_account.growth_rate / 100.0) * 0.5
                        account_current_balances[projected_account.name] = new_balance
                else:
                    # Standard projection logic for non-amortized accounts
                    # Ensure liabilities start as negative for consistent calculation logic
                    if projected_account.account_type == "liability" and current_balance > 0:
                        current_balance = -abs(current_balance)
                    
                    # Check if this is a dynamic cashflow item (linked to an asset)
                    # Format: "ItemName|LINKED:AssetName|PERCENTAGE:10.0"
                    linked_asset_name = None
                    linked_percentage = None
                    base_account_name = projected_account.name
                    
                    if "|LINKED:" in projected_account.name and "|PERCENTAGE:" in projected_account.name:
                        # Extract linked asset name and percentage
                        parts = projected_account.name.split("|LINKED:")
                        if len(parts) == 2:
                            base_account_name = parts[0]
                            rest = parts[1]
                            percent_parts = rest.split("|PERCENTAGE:")
                            if len(percent_parts) == 2:
                                linked_asset_name = percent_parts[0]
                                try:
                                    linked_percentage = float(percent_parts[1])
                                except ValueError:
                                    linked_percentage = None
                    
                    # Calculate contribution for this year
                    if linked_asset_name and linked_percentage is not None and projected_account.account_type in ["income", "expense"]:
                        # Dynamic item: recalculate contribution based on linked asset's current value
                        if linked_asset_name in account_current_balances:
                            linked_asset_value = account_current_balances[linked_asset_name]
                            # Calculate yearly value as percentage of linked asset value
                            yearly_value = linked_asset_value * (linked_percentage / 100.0)
                            adjusted_annual_contribution = yearly_value if projected_account.account_type == "income" else -yearly_value
                            print(f"--- DEBUG: Dynamic item {base_account_name} recalculated: {linked_asset_name} value={linked_asset_value:.2f}, {linked_percentage}% = {yearly_value:.2f} ---"); sys.stdout.flush()
                        else:
                            # Linked asset not found in projection, use 0
                            adjusted_annual_contribution = 0.0
                            print(f"--- WARNING: Linked asset {linked_asset_name} not found for dynamic item {base_account_name} ---"); sys.stdout.flush()
                    else:
                        # Fixed contribution item
                        # Monthly contribution
                        adjusted_annual_contribution = projected_account.contribution * 12
                        # Contributions to liabilities/expenses are negative cash flow
                        if projected_account.account_type in ["liability", "expense"]:
                            adjusted_annual_contribution = -abs(adjusted_annual_contribution) if adjusted_annual_contribution > 0 else adjusted_annual_contribution
                        elif projected_account.account_type == "income":
                             adjusted_annual_contribution = abs(adjusted_annual_contribution)

                    # Annual increase/decrease rate
                    effective_growth_rate = projected_account.growth_rate / 100.0

                    # Calculate growth on existing balance
                    growth_on_balance = current_balance * effective_growth_rate
                    
                    # Calculate growth on contributions (assuming contributions occur mid-year on average for 0.5 factor)
                    # For dynamic items, growth on contributions is typically 0 since the value is recalculated each year
                    growth_on_contributions = adjusted_annual_contribution * effective_growth_rate * 0.5 if not (linked_asset_name and linked_percentage is not None) else 0.0
                    
                    # New balance for the end of the current year
                    # For income/expense items, we track the annual flow value (they don't accumulate like assets/liabilities)
                    if projected_account.account_type in ["income", "expense"]:
                        # For cashflow items, the value tracked is the annual flow (contribution), not an accumulating balance
                        new_balance = adjusted_annual_contribution
                        # For next year's calculation, we still use 0 as starting balance for cashflow items
                        account_current_balances[projected_account.name] = 0.0
                    else:
                        new_balance = current_balance + adjusted_annual_contribution + growth_on_balance + growth_on_contributions
                        # Update for next year's starting balance
                        account_current_balances[projected_account.name] = new_balance
                
                # Record time series data for this account
                time_series_data_for_db.append(models.ProjectionTimeSeriesData(
                    year=year,
                    value_type="account_balance",
                    value=new_balance,
                    account=projected_account # Link to the model instance
                ))
                time_series_data_for_db.append(models.ProjectionTimeSeriesData(
                    year=year,
                    value_type="contribution_flow",
                    value=adjusted_annual_contribution,
                    account=projected_account
                ))
                time_series_data_for_db.append(models.ProjectionTimeSeriesData(
                    year=year,
                    value_type="growth_value",
                    value=(growth_on_balance + growth_on_contributions),
                    account=projected_account
                ))
                
                # Accumulate yearly totals
                if projected_account.account_type == "asset":
                    current_year_total_assets += new_balance
                elif projected_account.account_type == "liability":
                    current_year_total_liabilities += new_balance # Will be negative
                elif projected_account.account_type == "income":
                    current_year_total_income_flow += adjusted_annual_contribution
                elif projected_account.account_type == "expense":
                    current_year_total_expense_flow += adjusted_annual_contribution

                current_year_contributions_sum += adjusted_annual_contribution
                current_year_growth_sum += (growth_on_balance + growth_on_contributions)


            # Update overall totals
            total_contributed_overall += current_year_contributions_sum
            total_growth_overall += current_year_growth_sum

            # Add overall totals to time series data for the current year
            current_year_net_worth = current_year_total_assets + current_year_total_liabilities

            # Build yearly data points, cleaning up account names for display (remove LINKED markers)
            account_values = {}
            for acc in projected_accounts_for_db:
                # Clean account name for display (remove LINKED markers)
                display_name = acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name
                account_values[f"{display_name}_Value"] = account_current_balances[acc.name]
            
            yearly_data_points[year] = {
                "Year": current_year + year -1, # Display actual calendar year
                "Total Assets": current_year_total_assets,
                "Total Liabilities": current_year_total_liabilities,
                "Net Worth": current_year_net_worth,
                "Total Income Flow": current_year_total_income_flow,
                "Total Expense Flow": current_year_total_expense_flow,
                "Net Cash Flow": current_year_total_income_flow + current_year_total_expense_flow,
                **account_values # Individual account balances with _Value suffix
            }

            time_series_data_for_db.append(models.ProjectionTimeSeriesData(year=year, value_type="total_assets", value=current_year_total_assets))
            time_series_data_for_db.append(models.ProjectionTimeSeriesData(year=year, value_type="total_liabilities", value=current_year_total_liabilities))
            time_series_data_for_db.append(models.ProjectionTimeSeriesData(year=year, value_type="net_worth", value=current_year_net_worth))
            time_series_data_for_db.append(models.ProjectionTimeSeriesData(year=year, value_type="total_income_flow", value=current_year_total_income_flow))
            time_series_data_for_db.append(models.ProjectionTimeSeriesData(year=year, value_type="total_expense_flow", value=current_year_total_expense_flow))
            time_series_data_for_db.append(models.ProjectionTimeSeriesData(year=year, value_type="net_cash_flow", value=current_year_total_income_flow + current_year_total_expense_flow))


        # Final value is the net worth at the end of the last projected year
        final_value_projection = current_year_net_worth if years > 0 else sum(acc.initial_value for acc in projected_accounts_for_db)

        print(f"--- DEBUG: Finished projection. Final Value: {final_value_projection}, Total Contributed: {total_contributed_overall}, Total Growth: {total_growth_overall} ---"); sys.stdout.flush()
        
        # Convert yearly_data_points to a list of dicts for JSON serialization
        data_for_json = [yearly_data_points[year] for year in sorted(yearly_data_points.keys())]
        data_json_string = json.dumps(data_for_json)

        # Return the structured data ready for database saving
        return {
            "final_value": final_value_projection,
            "total_contributed": total_contributed_overall,
            "total_growth": total_growth_overall,
            "projected_accounts": projected_accounts_for_db,
            "time_series_data": time_series_data_for_db,
            "data_json": data_json_string # NEW: Include the JSON string of yearly data
        }
    except Exception as e:
        print(f"--- CRITICAL ERROR in calculate_projection: {e} (Traceback: {traceback.format_exc()}) ---"); sys.stdout.flush()
        raise e

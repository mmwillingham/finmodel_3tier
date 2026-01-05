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


def calculate_annual_principal_interest(
    principal: float,
    annual_interest_rate_percent: float,
    loan_term_months: int,
    loan_start_date: date,
    year: int
) -> dict:
    """
    Calculates the principal and interest breakdown for a specific year of an amortized loan.
    
    Args:
        principal: The initial principal amount of the loan.
        annual_interest_rate_percent: The annual interest rate as a percentage.
        loan_term_months: The total term of the loan in months.
        loan_start_date: The date when the loan started.
        year: The year number (1-indexed) for which to calculate breakdown.
    
    Returns:
        dict with keys: 'principal_paid', 'interest_paid', 'total_payment', 'remaining_balance'
    """
    if annual_interest_rate_percent == 0:
        monthly_payment = principal / loan_term_months
        months_paid_before_year = (year - 1) * 12
        if months_paid_before_year >= loan_term_months:
            return {'principal_paid': 0.0, 'interest_paid': 0.0, 'total_payment': 0.0, 'remaining_balance': 0.0}
        
        principal_paid_this_year = min(monthly_payment * 12, principal - (monthly_payment * months_paid_before_year))
        interest_paid_this_year = 0.0
        total_payment = principal_paid_this_year
        remaining_balance = principal - (monthly_payment * min(months_paid_before_year + 12, loan_term_months))
        return {
            'principal_paid': principal_paid_this_year,
            'interest_paid': interest_paid_this_year,
            'total_payment': total_payment,
            'remaining_balance': max(0.0, remaining_balance)
        }
    
    monthly_interest_rate = (annual_interest_rate_percent / 100) / 12
    monthly_payment = (principal * monthly_interest_rate) / (1 - pow(1 + monthly_interest_rate, -loan_term_months))
    
    # Calculate remaining balance at start of year
    months_paid_before_year = (year - 1) * 12
    if months_paid_before_year >= loan_term_months:
        return {'principal_paid': 0.0, 'interest_paid': 0.0, 'total_payment': 0.0, 'remaining_balance': 0.0}
    
    balance_at_start_of_year = principal * pow(1 + monthly_interest_rate, months_paid_before_year) - \
                               (monthly_payment / monthly_interest_rate) * (pow(1 + monthly_interest_rate, months_paid_before_year) - 1)
    balance_at_start_of_year = max(0.0, balance_at_start_of_year)
    
    # Calculate total payment for the year (12 months)
    total_payment = monthly_payment * 12
    
    # Calculate interest paid during the year
    # Approximate: Use average balance during the year
    balance_at_end_of_year = principal * pow(1 + monthly_interest_rate, months_paid_before_year + 12) - \
                             (monthly_payment / monthly_interest_rate) * (pow(1 + monthly_interest_rate, months_paid_before_year + 12) - 1)
    balance_at_end_of_year = max(0.0, balance_at_end_of_year)
    average_balance = (balance_at_start_of_year + balance_at_end_of_year) / 2.0
    interest_paid_this_year = average_balance * annual_interest_rate_percent / 100.0
    
    # Principal paid is total payment minus interest
    principal_paid_this_year = total_payment - interest_paid_this_year
    principal_paid_this_year = min(principal_paid_this_year, balance_at_start_of_year)  # Can't pay more than balance
    
    return {
        'principal_paid': principal_paid_this_year,
        'interest_paid': interest_paid_this_year,
        'total_payment': total_payment,
        'remaining_balance': balance_at_end_of_year
    }


def calculate_projection(years: int, accounts: List[schemas.ProjectedAccountCreate], db: Session, owner_id: int) -> dict:
    try:
        print(f"--- DEBUG: TOP OF calculate_projection function. Owner ID: {owner_id} ---"); sys.stdout.flush()
        print(f"--- DEBUG: ENTERED CALCULATIONS.PY: calculate_projection function for owner {owner_id} ---"); sys.stdout.flush()
        print(f"--- DEBUG: Accounts received by calculate_projection: {accounts} ---"); sys.stdout.flush() # NEW DEBUG

        # Load user settings for surplus asset and other settings
        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == owner_id).first()
        surplus_asset_id = user_settings.surplus_asset_id if user_settings else None
        surplus_asset_name = None
        if surplus_asset_id:
            surplus_asset = db.query(models.Asset).filter(models.Asset.id == surplus_asset_id, models.Asset.owner_id == owner_id).first()
            if surplus_asset:
                surplus_asset_name = surplus_asset.name

        # Load auto-disbursement rules
        auto_disbursements = db.query(models.AutoDisbursement).filter(
            models.AutoDisbursement.owner_id == owner_id
        ).all() if db else []

        # Load assets to get account information (for retirement account rules)
        all_assets = db.query(models.Asset).filter(models.Asset.owner_id == owner_id).all() if db else []
        asset_to_account_map = {}
        account_to_retirement_map = {}
        if all_assets:
            account_ids = [a.account_id for a in all_assets if a.account_id]
            if account_ids:
                accounts_list = db.query(models.Account).filter(models.Account.id.in_(account_ids)).all()
                account_to_retirement_map = {acc.id: acc.is_retirement for acc in accounts_list}
                asset_to_account_map = {a.id: a.account_id for a in all_assets if a.account_id}

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
            
            # Dictionary to store annual flow values for income/expense items (since they reset to 0)
            annual_flow_values = {}
            
            # Dictionary to store account values for this year (including principal/interest breakdown)
            account_values_for_year = {}

            for projected_account in projected_accounts_for_db:
                current_balance = account_current_balances[projected_account.name]
                
                # Special handling for amortized loans
                if projected_account.account_type == "liability" and projected_account.loan_type == "amortized" and projected_account.principal_amount is not None and projected_account.interest_rate is not None and projected_account.loan_term_months is not None and projected_account.loan_start_date is not None:
                    try:
                        loan_start_date_obj = datetime.strptime(projected_account.loan_start_date, "%Y-%m-%d").date()
                        calculation_date_obj = date(current_year + year -1, 12, 31) # End of current projection year
                        
                        # Calculate principal/interest breakdown for this year
                        breakdown = calculate_annual_principal_interest(
                            principal=projected_account.principal_amount,
                            annual_interest_rate_percent=projected_account.interest_rate,
                            loan_term_months=projected_account.loan_term_months,
                            loan_start_date=loan_start_date_obj,
                            year=year
                        )
                        
                        # Get liability model to check options
                        liability = None
                        if db:
                            liability = db.query(models.Liability).filter(
                                models.Liability.owner_id == owner_id,
                                models.Liability.name == projected_account.name
                            ).first()
                        
                        decrease_by_principal = liability.decrease_by_principal_yearly if liability else False
                        create_payment_expense = liability.create_payment_expense if liability else False
                        
                        # Calculate new balance
                        if decrease_by_principal:
                            # Decrease by principal paid this year
                            remaining_principal = calculate_amortized_loan_balance(
                                principal=projected_account.principal_amount,
                                annual_interest_rate_percent=projected_account.interest_rate,
                                loan_term_months=projected_account.loan_term_months,
                                loan_start_date=loan_start_date_obj,
                                calculation_date=calculation_date_obj
                            )
                            new_balance = -abs(remaining_principal)
                        else:
                            # Use standard amortization calculation
                            remaining_principal = calculate_amortized_loan_balance(
                                principal=projected_account.principal_amount,
                                annual_interest_rate_percent=projected_account.interest_rate,
                                loan_term_months=projected_account.loan_term_months,
                                loan_start_date=loan_start_date_obj,
                                calculation_date=calculation_date_obj
                            )
                            new_balance = -abs(remaining_principal)
                        
                        # Handle expense creation for payment
                        if create_payment_expense:
                            # Add payment amount to expense flow
                            payment_expense = breakdown['total_payment']
                            # Create a synthetic expense entry for this liability payment
                            if projected_account.name not in annual_flow_values:
                                annual_flow_values[projected_account.name + "_Payment"] = -payment_expense  # Negative for expense
                                current_year_total_expense_flow += payment_expense
                                print(f"--- DEBUG: Created payment expense of {payment_expense:.2f} for {projected_account.name} ---"); sys.stdout.flush()
                        
                        # Store principal/interest breakdown for this year
                        account_values_for_year[f"{projected_account.name}_Principal"] = breakdown['principal_paid']
                        account_values_for_year[f"{projected_account.name}_Interest"] = breakdown['interest_paid']
                        account_values_for_year[f"{projected_account.name}_Payment"] = breakdown['total_payment']
                        
                        # For amortized loans, the 'contribution' is the monthly payment, which is handled in the balance calculation itself.
                        adjusted_annual_contribution = 0.0
                        growth_on_balance = 0.0
                        growth_on_contributions = 0.0
                        
                        # Update balance for next year
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
                            # Find the linked asset to check if it's in a retirement account
                            linked_asset = None
                            for asset in all_assets:
                                if asset.name == linked_asset_name:
                                    linked_asset = asset
                                    break
                            
                            # Calculate yearly value as percentage of linked asset value
                            yearly_value = abs(linked_asset_value) * (linked_percentage / 100.0)
                            
                            # Retirement account rules: In retirement accounts, dividends/interest stay in the account
                            # In non-retirement accounts, they increase a linked asset and are available for spending
                            is_retirement = False
                            if linked_asset and linked_asset.account_id and linked_asset.account_id in account_to_retirement_map:
                                is_retirement = account_to_retirement_map[linked_asset.account_id]
                            
                            if projected_account.account_type == "income":
                                if is_retirement:
                                    # For retirement accounts, dividends/interest stay in the account (don't create income flow)
                                    adjusted_annual_contribution = 0.0
                                    # Add the dividend/interest directly to the linked asset
                                    account_current_balances[linked_asset_name] += yearly_value
                                    print(f"--- DEBUG: Retirement account - {yearly_value:.2f} added to {linked_asset_name} (not available for spending) ---"); sys.stdout.flush()
                                else:
                                    # For non-retirement accounts, dividends/interest are available for spending
                                    adjusted_annual_contribution = yearly_value
                                    print(f"--- DEBUG: Dynamic item {base_account_name} recalculated: {linked_asset_name} value={linked_asset_value:.2f}, {linked_percentage}% = {yearly_value:.2f} (available for spending) ---"); sys.stdout.flush()
                            else:
                                # Expenses (shouldn't normally be dynamic, but handle if needed)
                                adjusted_annual_contribution = -yearly_value
                                print(f"--- DEBUG: Dynamic expense item {base_account_name} recalculated: {linked_asset_name} value={linked_asset_value:.2f}, {linked_percentage}% = {yearly_value:.2f} ---"); sys.stdout.flush()
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
                        # For cashflow items, apply growth each year: yearly_value * (1 + growth_rate)^(year-1)
                        # adjusted_annual_contribution is the base yearly value (year 1), we need to apply compound growth
                        # For expenses, adjusted_annual_contribution is already negative, so we apply growth to the absolute value
                        base_yearly_value = abs(adjusted_annual_contribution)
                        # Apply growth: value grows by (1 + growth_rate)^(year-1), where year is 1-indexed
                        growth_factor = pow(1 + effective_growth_rate, year - 1)  # year is 1-indexed
                        new_balance = base_yearly_value * growth_factor
                        # Restore sign: expenses are negative, income is positive
                        if projected_account.account_type == "expense":
                            new_balance = -new_balance
                        # Store the annual flow value before resetting to 0 (needed for data_json)
                        annual_flow_values[projected_account.name] = new_balance
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


            # Apply expenses that contribute to assets (must happen after expense flows are calculated)
            # Query for expenses that contribute to assets and add their amounts to asset balances
            contributing_expenses = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.owner_id == owner_id,
                models.CashFlowItem.is_income == False,
                models.CashFlowItem.contributes_to_asset_id.isnot(None)
            ).all() if db else []
            
            for exp_item in contributing_expenses:
                # Find the target asset
                target_asset = db.query(models.Asset).filter(models.Asset.id == exp_item.contributes_to_asset_id).first()
                if target_asset and target_asset.name in account_current_balances:
                    # Calculate the expense amount for this year
                    expense_amount = 0.0
                    
                    # Check if this expense is in the projection accounts (for dynamic items)
                    expense_account_name = exp_item.description
                    if exp_item.linked_item_id and exp_item.linked_item_type and exp_item.percentage is not None:
                        # This is a dynamic expense - find the expense in annual_flow_values
                        # The expense name might have a |LINKED: marker
                        for flow_name, flow_value in annual_flow_values.items():
                            base_name = flow_name.split("|LINKED:")[0]
                            if base_name == exp_item.description:
                                expense_amount = abs(flow_value)  # Use absolute value (flow_value is negative for expenses)
                                break
                    else:
                        # Fixed expense - calculate with growth
                        base_yearly_value = exp_item.yearly_value
                        effective_growth_rate = (exp_item.inflation_percent or 0) / 100.0
                        growth_factor = pow(1 + effective_growth_rate, year - 1)
                        expense_amount = base_yearly_value * growth_factor
                    
                    # Add the expense amount to the asset balance
                    if expense_amount > 0:
                        account_current_balances[target_asset.name] += expense_amount
                        print(f"--- DEBUG: Added expense contribution of {expense_amount:.2f} from '{exp_item.description}' to asset '{target_asset.name}' for year {year} ---"); sys.stdout.flush()
            
            # Calculate cash flow surplus/deficit and apply to designated asset
            net_cash_flow = current_year_total_income_flow + current_year_total_expense_flow
            surplus_deficit = current_year_total_income_flow - abs(current_year_total_expense_flow)
            
            # Apply surplus/deficit to designated asset if configured (before auto-disbursements)
            if surplus_asset_name and surplus_asset_name in account_current_balances:
                account_current_balances[surplus_asset_name] += surplus_deficit
                print(f"--- DEBUG: Applied surplus/deficit of {surplus_deficit:.2f} to {surplus_asset_name} for year {year} ---"); sys.stdout.flush()

            # Apply auto-disbursement transfers
            current_year_date = date(current_year + year - 1, 1, 1)  # Start of current projection year
            for disbursement in auto_disbursements:
                # Check if disbursement is active for this year
                active = True
                if disbursement.start_date:
                    try:
                        start_date_obj = datetime.strptime(disbursement.start_date, "%Y-%m-%d").date()
                        if current_year_date < start_date_obj:
                            active = False
                    except ValueError:
                        pass
                if disbursement.end_date and active:
                    try:
                        end_date_obj = datetime.strptime(disbursement.end_date, "%Y-%m-%d").date()
                        if current_year_date > end_date_obj:
                            active = False
                    except ValueError:
                        pass
                
                if active:
                    # Find source and target asset names in projection
                    source_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.source_asset_id).first()
                    target_asset = db.query(models.Asset).filter(models.Asset.id == disbursement.target_asset_id).first()
                    
                    if source_asset and target_asset:
                        source_name = source_asset.name
                        target_name = target_asset.name
                        
                        if source_name in account_current_balances and target_name in account_current_balances:
                            source_balance = account_current_balances[source_name]
                            
                            # Calculate transfer amount
                            if disbursement.transfer_type == "percentage":
                                transfer_amount = abs(source_balance) * (disbursement.transfer_value / 100.0)
                            else:  # dollar_amount
                                transfer_amount = abs(disbursement.transfer_value)
                            
                            # Apply transfer (only if source has sufficient balance)
                            if abs(source_balance) >= transfer_amount:
                                account_current_balances[source_name] -= transfer_amount
                                account_current_balances[target_name] += transfer_amount
                                print(f"--- DEBUG: Applied auto-disbursement: {transfer_amount:.2f} from {source_name} to {target_name} for year {year} ---"); sys.stdout.flush()

            # Recalculate totals after surplus/deficit and auto-disbursements
            # This ensures assets reflect the transfers
            current_year_total_assets = 0.0
            for acc in projected_accounts_for_db:
                if acc.account_type == "asset" and acc.name in account_current_balances:
                    current_year_total_assets += account_current_balances[acc.name]

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
                # For income/expense items, use annual flow value; for others, use account balance
                if acc.account_type in ["income", "expense"]:
                    account_values[f"{display_name}_Value"] = annual_flow_values.get(acc.name, 0.0)
                else:
                    account_values[f"{display_name}_Value"] = account_current_balances.get(acc.name, 0.0)
            
            # Add principal/interest breakdown values
            account_values.update(account_values_for_year)
            
            yearly_data_points[year] = {
                "Year": current_year + year -1, # Display actual calendar year
                "Total Assets": current_year_total_assets,
                "Total Liabilities": current_year_total_liabilities,
                "Net Worth": current_year_net_worth,
                "Total Income Flow": current_year_total_income_flow,
                "Total Expense Flow": current_year_total_expense_flow,
                "Net Cash Flow": net_cash_flow,
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

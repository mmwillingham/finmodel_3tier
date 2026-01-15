import json
import logging
import traceback
import sys
# Disabled verbose debug logging - only keeping tax-related logs
# print(f"--- DEBUG: api/calculations.py LOADED ---"); sys.stdout.flush()

from typing import List, Optional
from sqlalchemy.orm import Session
import models
import schemas # Import schemas for type hinting
from datetime import date, datetime # Import datetime for parsing loan_start_date
from math import pow # NEW: For amortization calculation
from utils.tax_calculator import calculate_taxable_income # NEW: For federal tax calculation


logger = logging.getLogger(__name__)

def calculate_year_fraction(start_date_str: Optional[str], end_date_str: Optional[str], projection_year: int) -> float:
    """
    Calculate the fraction of a year an item is active based on start_date and end_date.
    Returns a value between 0 and 1 representing the fraction of the year.
    For one-time items (start_date == end_date), returns 1.0 for the year the date falls in.
    
    Args:
        start_date_str: Start date in YYYY-MM-DD format or None
        end_date_str: End date in YYYY-MM-DD format or None
        projection_year: The year to check (e.g., 2027)
    
    Returns:
        Fraction of the year (0 to 1), e.g., 0.5833 for 7 months, 1.0 for one-time items
    """
    year_start = date(projection_year, 1, 1)  # January 1 of the year
    year_end = date(projection_year, 12, 31)  # December 31 of the year
    
    item_start = year_start  # Default to start of year if no start_date
    item_end = year_end  # Default to end of year if no end_date
    
    if start_date_str:
        try:
            start_date_obj = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            # If item starts during the year, use that date; otherwise use year start
            item_start = start_date_obj if start_date_obj > year_start else year_start
        except (ValueError, TypeError):
            pass
    
    if end_date_str:
        try:
            end_date_obj = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            # If item ends during the year, use that date; otherwise use year end
            item_end = end_date_obj if end_date_obj < year_end else year_end
        except (ValueError, TypeError):
            pass
    
    # Special handling for one-time items (start_date == end_date)
    # Return 1.0 for the year the date falls in
    if start_date_str and end_date_str and start_date_str == end_date_str:
        try:
            one_time_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            if year_start <= one_time_date <= year_end:
                return 1.0
            else:
                return 0.0
        except (ValueError, TypeError):
            pass
    
    # If item ends before year starts or starts after year ends, return 0
    if item_end < year_start or item_start > year_end:
        return 0.0
    
    # Calculate the overlap period
    overlap_start = item_start if item_start > year_start else year_start
    overlap_end = item_end if item_end < year_end else year_end
    
    # Calculate days in overlap (add 1 to include both start and end days)
    overlap_days = (overlap_end - overlap_start).days + 1
    
    # Calculate fraction (days / days in year)
    days_in_year = (year_end - year_start).days + 1
    
    if days_in_year == 0:
        return 0.0
    
    fraction = overlap_days / days_in_year
    
    return max(0.0, min(1.0, fraction))  # Clamp between 0 and 1

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
        # Disabled verbose debug logging
        # print(f"--- DEBUG: TOP OF calculate_projection function. Owner ID: {owner_id} ---"); sys.stdout.flush()
        # print(f"--- DEBUG: ENTERED CALCULATIONS.PY: calculate_projection function for owner {owner_id} ---"); sys.stdout.flush()
        # print(f"--- DEBUG: Accounts received by calculate_projection: {accounts} ---"); sys.stdout.flush()

        # Load user settings for surplus asset and other settings
        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == owner_id).first()
        surplus_asset_id = user_settings.surplus_asset_id if user_settings else None
        surplus_asset_name = None
        if surplus_asset_id:
            surplus_asset = db.query(models.Asset).filter(models.Asset.id == surplus_asset_id, models.Asset.owner_id == owner_id).first()
            if surplus_asset:
                surplus_asset_name = surplus_asset.name
        
        # Constant to identify the federal tax expense item (DEPRECATED: Use cash_flow_item_id instead)
        FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)"
        
        # Check if federal tax calculation is enabled
        calculate_federal_tax = user_settings.calculate_federal_tax if user_settings else False
        
        # Pre-load CashFlowItems for tax calculation (keyed by ID for reliable lookup)
        # This replaces the fragile description-based matching with ID-based lookups
        cash_flow_items_by_id = {}
        if db:
            all_cash_flow_items = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.owner_id == owner_id
            ).all()
            for item in all_cash_flow_items:
                cash_flow_items_by_id[item.id] = item
            # Debug: Log what income items are loaded
            income_items_loaded = [f"{item.id}:{item.description}(taxable={item.taxable})" for item in all_cash_flow_items if item.is_income]
            # Disabled verbose debug logging
            # print(f"--- DEBUG: Loaded {len(income_items_loaded)} income items for tax calculation: {income_items_loaded} ---"); sys.stdout.flush()
            # Also log all cash flow items for debugging
            all_items_loaded = [f"{item.id}:{item.description}(is_income={item.is_income},taxable={item.taxable if item.is_income else 'N/A'})" for item in all_cash_flow_items]
            # Disabled verbose debug logging
            # print(f"--- DEBUG: Loaded {len(all_items_loaded)} total cash flow items: {all_items_loaded} ---"); sys.stdout.flush()

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

        # Prepare initial projected accounts based on input
        # These will be associated with the Projection after it's created and has an ID
        for acc_schema in accounts:
            # Disabled verbose debug logging
            # print(f"--- DEBUG: Account Schema - Name: {acc_schema.name}, Type: {acc_schema.account_type}, Initial Value: {acc_schema.initial_value}, Contribution: {acc_schema.contribution}, Growth Rate: {acc_schema.growth_rate}, Loan Type: {acc_schema.loan_type}, Principal: {acc_schema.principal_amount}, Interest Rate: {acc_schema.interest_rate}, Loan Term: {acc_schema.loan_term_months}, Loan Start Date: {acc_schema.loan_start_date} ---"); sys.stdout.flush()
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
                monthly_payment=acc_schema.monthly_payment,
                # Fields for cash flow items (income/expense)
                start_date=acc_schema.start_date,
                end_date=acc_schema.end_date,
                # NEW: Store cash_flow_item_id for reliable ID-based lookups
                cash_flow_item_id=acc_schema.cash_flow_item_id
                # projection_id will be set later
            )
            projected_accounts_for_db.append(projected_account)

        # Get current year for accurate loan balance calculations
        current_year = date.today().year
        
        # Dictionary to hold current balances for each account, updated yearly
        # For income/expense items, initial_value is 0 (they don't have balances)
        # For assets/liabilities with start_date, initialize with 0 (they'll be initialized in their first active year)
        account_current_balances = {}
        for acc in projected_accounts_for_db:
            if acc.account_type in ["asset", "liability"] and acc.start_date:
                # Check if start_date is after the projection start year
                try:
                    start_date_obj = datetime.strptime(acc.start_date, "%Y-%m-%d").date()
                    projection_start_year = date(current_year, 1, 1)
                    if start_date_obj > projection_start_year:
                        # Asset/liability starts mid-year, initialize with 0
                        account_current_balances[acc.name] = 0.0
                    else:
                        # Asset/liability starts in first year, use initial_value
                        account_current_balances[acc.name] = acc.initial_value
                except (ValueError, TypeError):
                    # Invalid date format, use initial_value as fallback
                    account_current_balances[acc.name] = acc.initial_value
            else:
                # No start_date or not asset/liability, use initial_value
                account_current_balances[acc.name] = acc.initial_value
        yearly_data_points = {} # NEW: Dictionary to build up data for data_json

        # Initialize global totals for the entire projection period
        total_contributed_overall = 0.0
        total_growth_overall = 0.0

        # Main Projection Loop
        for year in range(1, years + 1):
            # Disabled verbose debug logging
            # print(f"--- DEBUG: Starting projection for Year {year} ---"); sys.stdout.flush()

            # Yearly aggregates
            current_year_total_assets = 0.0
            current_year_total_liabilities = 0.0
            current_year_total_income_flow = 0.0
            current_year_total_expense_flow = 0.0
            current_year_contributions_sum = 0.0 # Sum of all contributions for this year
            current_year_growth_sum = 0.0 # Sum of all growth for this year
            
            # Track taxable income and tax-deductible expenses for federal tax calculation
            current_year_taxable_income = 0.0
            current_year_qualified_dividends = 0.0  # NEW: Track qualified dividends separately
            current_year_tax_deductible_expenses = 0.0
            
            # Dictionary to store annual flow values for income/expense items (since they reset to 0)
            annual_flow_values = {}
            
            # Dictionary to store account values for this year (including principal/interest breakdown)
            account_values_for_year = {}

            for projected_account in projected_accounts_for_db:
                current_balance = account_current_balances[projected_account.name]
                
                # Check if item is active for this year and calculate proration fraction
                # This check must happen BEFORE calculating contributions so inactive items are skipped
                current_projection_year = current_year + year - 1
                year_fraction = 1.0  # Default to full year if no dates
                is_active_for_year = True
                if projected_account.account_type in ["income", "expense", "asset", "liability"]:
                    year_fraction = calculate_year_fraction(
                        projected_account.start_date,
                        projected_account.end_date,
                        current_projection_year
                    )
                    is_active_for_year = year_fraction > 0.0
                
                # For assets/liabilities that start mid-year, initialize with initial_value in their first active year
                if projected_account.account_type in ["asset", "liability"] and is_active_for_year and current_balance == 0.0 and projected_account.start_date:
                    # This is the first year the asset/liability becomes active, initialize with initial_value
                    current_balance = projected_account.initial_value
                    account_current_balances[projected_account.name] = current_balance
                
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
                        
                        # For amortized loans, if item is not active for this year (after end date), set balance to 0
                        if not is_active_for_year:
                            new_balance = 0.0
                            adjusted_annual_contribution = 0.0
                            growth_on_balance = 0.0
                            growth_on_contributions = 0.0
                            # Store zero balance for this year
                            account_values_for_year[f"{projected_account.name}_Value"] = new_balance
                            # Update balance for next year
                            account_current_balances[projected_account.name] = new_balance
                        else:
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
                                    # Disabled verbose debug logging
                                    # print(f"--- DEBUG: Created payment expense of {payment_expense:.2f} for {projected_account.name} ---"); sys.stdout.flush()
                            
                            # Store principal/interest breakdown for this year
                            account_values_for_year[f"{projected_account.name}_Principal"] = breakdown['principal_paid']
                            account_values_for_year[f"{projected_account.name}_Interest"] = breakdown['interest_paid']
                            account_values_for_year[f"{projected_account.name}_Payment"] = breakdown['total_payment']
                            # Store the liability balance value for this year (needed for charts)
                            account_values_for_year[f"{projected_account.name}_Value"] = new_balance
                            
                            # For amortized loans, the 'contribution' is the monthly payment, which is handled in the balance calculation itself.
                            adjusted_annual_contribution = 0.0
                            growth_on_balance = 0.0
                            growth_on_contributions = 0.0
                            
                            # Update balance for next year
                            account_current_balances[projected_account.name] = new_balance

                    except ValueError:
                        # Disabled verbose debug logging (errors still logged)
                        # print(f"--- DEBUG: Invalid loan_start_date format for {projected_account.name}. Skipping amortization calculation. (Traceback: {traceback.format_exc()}) ---"); sys.stdout.flush()
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
                    
                    # Check if this is a dynamic cashflow item (linked to an asset or income)
                    # Format: "ItemName|LINKED:AssetName|PERCENTAGE:10.0" (single asset)
                    # Format: "ItemName|LINKED:Asset1,Asset2,Asset3|PERCENTAGE:10.0" (multiple assets)
                    # Format: "ItemName|LINKED_INCOME:IncomeItemName|PERCENTAGE:10.0" (linked to income)
                    linked_asset_names = []
                    linked_percentage = None
                    linked_income_name = None
                    base_account_name = projected_account.name
                    
                    # Check for expense linked to income
                    if "|LINKED_INCOME:" in projected_account.name and "|PERCENTAGE:" in projected_account.name and projected_account.account_type == "expense":
                        # Disabled verbose debug logging
                        # print(f"--- DEBUG: Found expense linked to income: {projected_account.name} ---"); sys.stdout.flush()
                        parts = projected_account.name.split("|LINKED_INCOME:")
                        if len(parts) == 2:
                            base_account_name = parts[0]
                            rest = parts[1]
                            percent_parts = rest.split("|PERCENTAGE:")
                            if len(percent_parts) == 2:
                                linked_income_name = percent_parts[0].strip()
                                try:
                                    linked_percentage = float(percent_parts[1])
                                    # Disabled verbose debug logging
                                    # print(f"--- DEBUG: Parsed expense '{base_account_name}' linked to income '{linked_income_name}' at {linked_percentage}% ---"); sys.stdout.flush()
                                except ValueError:
                                    linked_percentage = None
                                    print(f"--- WARNING: Could not parse percentage for expense linked to income: {projected_account.name} ---"); sys.stdout.flush()
                    
                    # Check for item linked to asset(s)
                    elif "|LINKED:" in projected_account.name and "|PERCENTAGE:" in projected_account.name:
                        # Extract linked asset name(s) and percentage
                        parts = projected_account.name.split("|LINKED:")
                        if len(parts) == 2:
                            base_account_name = parts[0]
                            rest = parts[1]
                            percent_parts = rest.split("|PERCENTAGE:")
                            if len(percent_parts) == 2:
                                linked_asset_names_str = percent_parts[0]
                                # Split by comma to handle multiple assets
                                linked_asset_names = [name.strip() for name in linked_asset_names_str.split(",") if name.strip()]
                                try:
                                    linked_percentage = float(percent_parts[1])
                                except ValueError:
                                    linked_percentage = None
                    
                    # Calculate contribution for this year
                    # Skip calculation if item is not active for this year (for income/expense items)
                    if not is_active_for_year and projected_account.account_type in ["income", "expense"]:
                        adjusted_annual_contribution = 0.0
                    elif linked_income_name and linked_percentage is not None and projected_account.account_type == "expense":
                        # Expense linked to income - always recalculate income value (don't rely on annual_flow_values which might be stale)
                        # This ensures the expense adjusts correctly when income changes or ends
                        linked_income_flow_value = 0.0
                        
                        # Query the linked income item from database
                        linked_income_item = None
                        if db:
                            linked_income_item = db.query(models.CashFlowItem).filter(
                                models.CashFlowItem.owner_id == owner_id,
                                models.CashFlowItem.is_income == True,
                                models.CashFlowItem.description == linked_income_name
                            ).first()
                        else:
                            # Fallback: search in cash_flow_items_by_description if available
                            if linked_income_name in cash_flow_items_by_description:
                                item = cash_flow_items_by_description[linked_income_name]
                                if item.is_income:
                                    linked_income_item = item
                        
                        if linked_income_item:
                            income_year_fraction = calculate_year_fraction(
                                linked_income_item.start_date,
                                linked_income_item.end_date,
                                current_projection_year
                            )
                            
                            if income_year_fraction > 0.0:
                                # Check if it's a dynamic income item
                                if linked_income_item.linked_item_type == "asset" and linked_income_item.percentage is not None:
                                    # Recalculate from linked assets (for current year)
                                    linked_asset_ids = []
                                    if hasattr(linked_income_item, 'linked_asset_ids') and linked_income_item.linked_asset_ids:
                                        linked_asset_ids = linked_income_item.linked_asset_ids
                                    if linked_income_item.linked_item_id:
                                        if linked_income_item.linked_item_id not in linked_asset_ids:
                                            linked_asset_ids = [linked_income_item.linked_item_id] + linked_asset_ids
                                    
                                    if linked_asset_ids:
                                        total_linked_asset_value = 0.0
                                        for asset_id in linked_asset_ids:
                                            for asset in all_assets:
                                                if asset.id == asset_id and asset.name in account_current_balances:
                                                    total_linked_asset_value += abs(account_current_balances[asset.name])
                                                    break
                                        
                                        if total_linked_asset_value > 0:
                                            linked_income_flow_value = total_linked_asset_value * (linked_income_item.percentage / 100.0) * income_year_fraction
                                else:
                                    # Fixed income - calculate with growth for this specific year
                                    base_yearly_value = linked_income_item.yearly_value
                                    effective_growth_rate = (linked_income_item.annual_increase_percent or 0) / 100.0
                                    growth_factor = pow(1 + effective_growth_rate, year - 1)
                                    linked_income_flow_value = base_yearly_value * growth_factor * income_year_fraction
                        
                        # Calculate expense as percentage of income
                        expense_amount = abs(linked_income_flow_value) * (linked_percentage / 100.0)
                        adjusted_annual_contribution = -expense_amount  # Negative for expense
                        # Disabled verbose debug logging
                        # print(f"--- DEBUG: Expense '{base_account_name}' linked to income '{linked_income_name}': {expense_amount:.2f} ({linked_percentage}% of {linked_income_flow_value:.2f}) ---"); sys.stdout.flush()
                    elif linked_asset_names and len(linked_asset_names) > 0 and linked_percentage is not None and projected_account.account_type in ["income", "expense"]:
                        # Dynamic item: recalculate contribution based on linked asset(s) current value
                        # Only calculate if item is active for this year
                        # Sum up values from all linked assets
                        total_linked_asset_value = 0.0
                        linked_assets_found = []
                        
                        for linked_asset_name in linked_asset_names:
                            if linked_asset_name in account_current_balances:
                                asset_value = account_current_balances[linked_asset_name]
                                total_linked_asset_value += abs(asset_value)
                                
                                # Find the linked asset to check if it's in a retirement account
                                for asset in all_assets:
                                    if asset.name == linked_asset_name:
                                        linked_assets_found.append(asset)
                                        break
                        
                        if total_linked_asset_value > 0:
                            # Calculate yearly value as percentage of total linked asset values
                            yearly_value = total_linked_asset_value * (linked_percentage / 100.0)
                            
                            # Check if any linked asset is in a retirement account
                            # If any asset is retirement, the income stays in those accounts
                            has_retirement_assets = False
                            retirement_assets = []
                            non_retirement_assets = []
                            
                            for linked_asset in linked_assets_found:
                                is_retirement = False
                                if linked_asset.account_id and linked_asset.account_id in account_to_retirement_map:
                                    is_retirement = account_to_retirement_map[linked_asset.account_id]
                                
                                if is_retirement:
                                    has_retirement_assets = True
                                    retirement_assets.append(linked_asset)
                                else:
                                    non_retirement_assets.append(linked_asset)
                            
                            if projected_account.account_type == "income":
                                if has_retirement_assets:
                                    # For retirement accounts, dividends/interest stay in the accounts
                                    # Distribute proportionally to retirement assets only
                                    retirement_total_value = sum([abs(account_current_balances[asset.name]) for asset in retirement_assets])
                                    if retirement_total_value > 0:
                                        for asset in retirement_assets:
                                            asset_value = abs(account_current_balances[asset.name])
                                            asset_portion = (asset_value / retirement_total_value) * yearly_value
                                            account_current_balances[asset.name] += asset_portion
                                    
                                    # Income available for spending is based on non-retirement assets only
                                    if non_retirement_assets:
                                        non_retirement_total_value = sum([abs(account_current_balances[asset.name]) for asset in non_retirement_assets])
                                        if total_linked_asset_value > 0:
                                            adjusted_annual_contribution = (non_retirement_total_value / total_linked_asset_value) * yearly_value
                                        else:
                                            adjusted_annual_contribution = 0.0
                                    else:
                                        adjusted_annual_contribution = 0.0
                                    
                                    print(f"--- DEBUG: Retirement accounts - {yearly_value:.2f} distributed to retirement assets, {adjusted_annual_contribution:.2f} available for spending ---"); sys.stdout.flush()
                                else:
                                    # For non-retirement accounts, dividends/interest are available for spending
                                    adjusted_annual_contribution = yearly_value
                                    # Disabled verbose debug logging
                                    # print(f"--- DEBUG: Dynamic item {base_account_name} recalculated: {len(linked_asset_names)} assets total value={total_linked_asset_value:.2f}, {linked_percentage}% = {yearly_value:.2f} (available for spending) ---"); sys.stdout.flush()
                            else:
                                # Expenses (shouldn't normally be dynamic, but handle if needed)
                                adjusted_annual_contribution = -yearly_value
                                print(f"--- DEBUG: Dynamic expense item {base_account_name} recalculated: {len(linked_asset_names)} assets total value={total_linked_asset_value:.2f}, {linked_percentage}% = {yearly_value:.2f} ---"); sys.stdout.flush()
                        else:
                            # Linked assets not found in projection, use 0
                            adjusted_annual_contribution = 0.0
                            print(f"--- WARNING: Linked assets {linked_asset_names} not found for dynamic item {base_account_name} ---"); sys.stdout.flush()
                    else:
                        # Fixed contribution item
                        # Skip calculation if item is not active for this year (for income/expense items)
                        if not is_active_for_year and projected_account.account_type in ["income", "expense"]:
                            adjusted_annual_contribution = 0.0
                        else:
                            # Monthly contribution
                            adjusted_annual_contribution = projected_account.contribution * 12
                            # Contributions to liabilities/expenses are negative cash flow
                            if projected_account.account_type in ["liability", "expense"]:
                                adjusted_annual_contribution = -abs(adjusted_annual_contribution) if adjusted_annual_contribution > 0 else adjusted_annual_contribution
                            elif projected_account.account_type == "income":
                                 adjusted_annual_contribution = abs(adjusted_annual_contribution)

                    # Annual increase/decrease rate
                    effective_growth_rate = projected_account.growth_rate / 100.0

                    # Calculate growth on existing balance (apply compound growth for partial years for assets/liabilities)
                    if projected_account.account_type in ["asset", "liability"]:
                        # Apply compound growth: value * (1 + rate)^year_fraction - 1
                        # Example: 100,000 * 1.05^0.5 = 102,469.51 for half year at 5%
                        growth_on_balance = current_balance * (pow(1 + effective_growth_rate, year_fraction) - 1)
                    else:
                        # For income/expense items, use simple annual rate (they're flows, not balances)
                        growth_on_balance = current_balance * effective_growth_rate
                    
                    # Calculate growth on contributions (assuming contributions occur mid-year on average for 0.5 factor)
                    # For dynamic items (linked to assets or income), growth on contributions is typically 0 since the value is recalculated each year
                    is_dynamic_for_growth = (linked_asset_names and len(linked_asset_names) > 0 and linked_percentage is not None) or (linked_income_name and linked_percentage is not None)
                    if projected_account.account_type in ["asset", "liability"]:
                        # Apply compound growth on contributions for partial years
                        # Contributions are assumed to occur mid-year, so apply growth for (year_fraction * 0.5) of the year
                        contribution_growth_period = year_fraction * 0.5  # Contributions occur mid-year
                        growth_on_contributions = adjusted_annual_contribution * (pow(1 + effective_growth_rate, contribution_growth_period) - 1) if not is_dynamic_for_growth else 0.0
                    else:
                        growth_on_contributions = adjusted_annual_contribution * effective_growth_rate * 0.5 if not is_dynamic_for_growth else 0.0
                    
                    # New balance for the end of the current year
                    # For income/expense items, we track the annual flow value (they don't accumulate like assets/liabilities)
                    if projected_account.account_type in ["income", "expense"]:
                        # Check if this is a dynamic item (linked to assets or income)
                        is_dynamic_item = (linked_asset_names and len(linked_asset_names) > 0 and linked_percentage is not None) or (linked_income_name and linked_percentage is not None)
                        
                        if is_dynamic_item:
                            # For dynamic items, the value is already calculated and doesn't need growth applied
                            # The growth is built into the asset values themselves
                            base_yearly_value = abs(adjusted_annual_contribution)
                            # Prorate the value based on how many months the item is active in this year
                            new_balance = base_yearly_value * year_fraction
                            # Restore sign: expenses are negative, income is positive
                            if projected_account.account_type == "expense":
                                new_balance = -new_balance
                            # Debug logging for dynamic items with 0 value
                            if projected_account.account_type == "income" and new_balance == 0.0 and linked_asset_names:
                                print(f"--- WARNING: Dynamic income item '{base_account_name}' has 0 value. Linked assets: {linked_asset_names}, Percentage: {linked_percentage} ---"); sys.stdout.flush()
                        else:
                            # For fixed cashflow items, apply growth each year: yearly_value * (1 + growth_rate)^(year-1)
                            # adjusted_annual_contribution is the base yearly value (year 1), we need to apply compound growth
                            # For expenses, adjusted_annual_contribution is already negative, so we apply growth to the absolute value
                            base_yearly_value = abs(adjusted_annual_contribution)
                            # Apply growth: value grows by (1 + growth_rate)^(year-1), where year is 1-indexed
                            growth_factor = pow(1 + effective_growth_rate, year - 1)  # year is 1-indexed
                            new_balance = base_yearly_value * growth_factor
                            # Prorate the value based on how many months the item is active in this year
                            new_balance = new_balance * year_fraction
                            # Restore sign: expenses are negative, income is positive
                            if projected_account.account_type == "expense":
                                new_balance = -new_balance
                        
                        # Store the annual flow value before resetting to 0 (needed for data_json)
                        # Use base_account_name for expenses linked to income so charts can match it correctly
                        flow_key = base_account_name if (linked_income_name and linked_percentage is not None) else projected_account.name
                        annual_flow_values[flow_key] = new_balance
                        # Also store with full name for backward compatibility
                        if flow_key != projected_account.name:
                            annual_flow_values[projected_account.name] = new_balance
                        
                        # Track taxable income and tax-deductible expenses for federal tax calculation
                        # NEW: Use ID-based lookup, with fallback to description-based for backward compatibility
                        if calculate_federal_tax and is_active_for_year:
                            # Initialize base_item_name here so it's available for all code paths
                            base_item_name = base_account_name
                            
                            cash_flow_item = None
                            
                            # Debug: Log what we're looking for
                            # Disabled verbose debug logging
                            # print(f"--- DEBUG: Year {year} - Processing {projected_account.account_type} '{projected_account.name}' (cash_flow_item_id={projected_account.cash_flow_item_id}, base_account_name='{base_account_name}', new_balance={new_balance:.2f}) ---"); sys.stdout.flush()
                            
                            # Try ID-based lookup first (preferred method)
                            if projected_account.cash_flow_item_id:
                                cash_flow_item = cash_flow_items_by_id.get(projected_account.cash_flow_item_id)
                                if cash_flow_item:
                                    # Disabled verbose debug logging (keeping tax-related logs)
                                    # print(f"--- DEBUG: Year {year} - Found CashFlowItem by ID {projected_account.cash_flow_item_id}: description='{cash_flow_item.description}', is_income={cash_flow_item.is_income}, taxable={cash_flow_item.taxable if hasattr(cash_flow_item, 'taxable') else 'N/A'} ---"); sys.stdout.flush()
                                    pass
                                else:
                                    print(f"--- DEBUG: Year {year} - CashFlowItem with ID {projected_account.cash_flow_item_id} not found in cash_flow_items_by_id. This should not happen. ---"); sys.stdout.flush()
                            
                            # Fallback to description-based lookup for backward compatibility (old projections without cash_flow_item_id)
                            if not cash_flow_item and projected_account.account_type in ["income", "expense"]:
                                # Use base account name (remove LINKED markers) for lookup
                                # Build description-based lookup map by searching through cash_flow_items_by_id
                                print(f"--- DEBUG: Year {year} - Attempting fallback description-based lookup for '{base_item_name}' (cash_flow_item_id is NULL or not found). Available items in cash_flow_items_by_id: {[f'{item.id}:{item.description}' for item in cash_flow_items_by_id.values()]} ---"); sys.stdout.flush()
                                for item in cash_flow_items_by_id.values():
                                    if item.description == base_item_name:
                                        cash_flow_item = item
                                        print(f"--- DEBUG: Year {year} - Using fallback description-based lookup for '{base_item_name}' (cash_flow_item_id is NULL) - Found: ID={item.id}, description='{item.description}', is_income={item.is_income}, taxable={item.taxable if hasattr(item, 'taxable') else 'N/A'} ---"); sys.stdout.flush()
                                        break
                                
                                if not cash_flow_item:
                                    print(f"--- DEBUG: Year {year} - Fallback lookup failed: No CashFlowItem found with description='{base_item_name}' ---"); sys.stdout.flush()
                            
                            if cash_flow_item:
                                if projected_account.account_type == "income" and cash_flow_item.is_income:
                                    if cash_flow_item.taxable:
                                        # Use the absolute value (new_balance is positive for income)
                                        income_amount = abs(new_balance)
                                        current_year_taxable_income += income_amount
                                        lookup_method = f"ID:{projected_account.cash_flow_item_id}" if projected_account.cash_flow_item_id else f"description:{base_item_name}"
                                        # Keeping this log - it's tax-related but might be verbose. Uncomment if needed for debugging
                                        # print(f"--- DEBUG: Year {year} - Added taxable income ({lookup_method}, {cash_flow_item.description}): {income_amount:.2f}. Total taxable income so far: {current_year_taxable_income:.2f} ---"); sys.stdout.flush()
                                        # Track qualified dividends separately if applicable
                                        if cash_flow_item.is_qualified_dividend:
                                            current_year_qualified_dividends += income_amount
                                    else:
                                        lookup_method = f"ID:{projected_account.cash_flow_item_id}" if projected_account.cash_flow_item_id else f"description:{base_item_name}"
                                        # Disabled verbose debug logging (tax-related but verbose - uncomment if needed)
                                        # print(f"--- DEBUG: Year {year} - Income item ({lookup_method}, {cash_flow_item.description}) has taxable=False, skipping for tax calculation (income amount: {abs(new_balance):.2f}) ---"); sys.stdout.flush()
                                elif projected_account.account_type == "expense" and not cash_flow_item.is_income:
                                    # Skip federal tax expense item itself (check by description for now, will be removed once frontend passes ID)
                                    if cash_flow_item.description != FEDERAL_TAX_EXPENSE_DESCRIPTION and cash_flow_item.tax_deductible:
                                        # Use the absolute value (new_balance is negative for expenses)
                                        current_year_tax_deductible_expenses += abs(new_balance)
                            else:
                                print(f"--- DEBUG: Year {year} - CashFlowItem not found for {projected_account.account_type} '{projected_account.name}' (base_account_name='{base_account_name}'). Skipping tax calculation for this item. ---"); sys.stdout.flush()
                        
                        # For next year's calculation, we still use 0 as starting balance for cashflow items
                        account_current_balances[projected_account.name] = 0.0
                    else:
                        # For assets/liabilities, if item is not active for this year (after end date), set balance to 0
                        if not is_active_for_year and projected_account.account_type in ["asset", "liability"]:
                            new_balance = 0.0
                        else:
                            new_balance = current_balance + adjusted_annual_contribution + growth_on_balance + growth_on_contributions
                        
                        # Store the balance value for this year (needed for charts)
                        # If asset/liability ends mid-year, store 0 (asset no longer exists at end of year)
                        # Otherwise, store the calculated balance
                        value_to_store = 0.0
                        if projected_account.account_type in ["asset", "liability"] and projected_account.end_date:
                            try:
                                end_date_obj = datetime.strptime(projected_account.end_date, "%Y-%m-%d").date()
                                year_end_date = date(current_projection_year, 12, 31)
                                # If end_date is in this year and before year end, store 0 (asset ends mid-year)
                                if end_date_obj.year == current_projection_year and end_date_obj < year_end_date:
                                    value_to_store = 0.0
                                else:
                                    value_to_store = new_balance
                            except (ValueError, TypeError):
                                # If end_date parsing fails, use new_balance
                                value_to_store = new_balance
                        else:
                            value_to_store = new_balance
                        
                        account_values_for_year[f"{projected_account.name}_Value"] = value_to_store
                        
                        # Update for next year's starting balance
                        # If item ends this year (year_fraction < 1.0 and end_date is in this year), 
                        # set balance to 0 for next year since asset no longer exists after end_date
                        if projected_account.account_type in ["asset", "liability"] and projected_account.end_date:
                            try:
                                end_date_obj = datetime.strptime(projected_account.end_date, "%Y-%m-%d").date()
                                year_end_date = date(current_projection_year, 12, 31)
                                # If end_date is in this year and before year end, balance should be 0 next year
                                if end_date_obj.year == current_projection_year and end_date_obj < year_end_date:
                                    account_current_balances[projected_account.name] = 0.0
                                else:
                                    account_current_balances[projected_account.name] = new_balance
                            except (ValueError, TypeError):
                                # If end_date parsing fails, use new_balance
                                account_current_balances[projected_account.name] = new_balance
                        else:
                            account_current_balances[projected_account.name] = new_balance
                
                # Note: Date checking for income/expense items is now done at the start of the loop
                # If item is not active, adjusted_annual_contribution is already set to 0.0
                
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
                # Check if expense is active for this year and calculate proration
                current_projection_year = current_year + year - 1
                expense_year_fraction = calculate_year_fraction(
                    exp_item.start_date,
                    exp_item.end_date,
                    current_projection_year
                )
                
                if expense_year_fraction <= 0.0:
                    continue  # Skip this expense for this year
                
                # Find the target asset
                target_asset = db.query(models.Asset).filter(models.Asset.id == exp_item.contributes_to_asset_id).first()
                if target_asset and target_asset.name in account_current_balances:
                    # Calculate the expense amount for this year
                    expense_amount = 0.0
                    
                    # Check if this expense is in the projection accounts (for dynamic items)
                    expense_account_name = exp_item.description
                    if exp_item.linked_item_id and exp_item.linked_item_type and exp_item.percentage is not None:
                        # This is a dynamic expense
                        if exp_item.linked_item_type == "asset":
                            # Linked to asset - find the expense in annual_flow_values
                            # The expense name might have a |LINKED: marker
                            for flow_name, flow_value in annual_flow_values.items():
                                base_name = flow_name.split("|LINKED:")[0]
                                if base_name == exp_item.description:
                                    expense_amount = abs(flow_value)  # Use absolute value (flow_value is negative for expenses)
                                    break
                        elif exp_item.linked_item_type == "income":
                            # Linked to income - calculate based on linked income item's annual flow value
                            linked_income_item = db.query(models.CashFlowItem).filter(
                                models.CashFlowItem.id == exp_item.linked_item_id,
                                models.CashFlowItem.owner_id == owner_id,
                                models.CashFlowItem.is_income == True
                            ).first()
                            if linked_income_item:
                                # Check if income item is active for this year first
                                current_projection_year = current_year + year - 1
                                income_year_fraction = calculate_year_fraction(
                                    linked_income_item.start_date,
                                    linked_income_item.end_date,
                                    current_projection_year
                                )
                                
                                if income_year_fraction <= 0.0:
                                    # Income item is not active for this year, so expense should be 0
                                    linked_income_flow_value = 0.0
                                else:
                                    # Always recalculate the income value for this year (don't rely on annual_flow_values which might be stale)
                                    # This ensures the expense adjusts correctly when income changes or ends
                                    linked_income_flow_value = 0.0
                                    
                                    # Check if this is a dynamic income item (linked to assets)
                                    if linked_income_item.linked_item_type == "asset" and linked_income_item.percentage is not None:
                                        # This is a dynamic income item - recalculate it based on current asset values for this year
                                        linked_asset_ids = []
                                        if hasattr(linked_income_item, 'linked_asset_ids') and linked_income_item.linked_asset_ids:
                                            linked_asset_ids = linked_income_item.linked_asset_ids
                                        if linked_income_item.linked_item_id:
                                            if linked_income_item.linked_item_id not in linked_asset_ids:
                                                linked_asset_ids = [linked_income_item.linked_item_id] + linked_asset_ids
                                        
                                        if linked_asset_ids:
                                            total_linked_asset_value = 0.0
                                            for asset_id in linked_asset_ids:
                                                linked_asset = db.query(models.Asset).filter(models.Asset.id == asset_id, models.Asset.owner_id == owner_id).first()
                                                if linked_asset and linked_asset.name in account_current_balances:
                                                    total_linked_asset_value += abs(account_current_balances[linked_asset.name])
                                            
                                            if total_linked_asset_value > 0:
                                                linked_income_flow_value = total_linked_asset_value * (linked_income_item.percentage / 100.0) * income_year_fraction
                                                print(f"--- DEBUG: Recalculated dynamic income '{linked_income_item.description}' from assets: {total_linked_asset_value:.2f} * {linked_income_item.percentage}% = {linked_income_flow_value:.2f} ---"); sys.stdout.flush()
                                    else:
                                        # Fixed income item - calculate with growth for this specific year
                                        base_yearly_value = linked_income_item.yearly_value
                                        effective_growth_rate = (linked_income_item.annual_increase_percent or 0) / 100.0
                                        growth_factor = pow(1 + effective_growth_rate, year - 1)
                                        linked_income_flow_value = base_yearly_value * growth_factor * income_year_fraction
                                        # Disabled verbose debug logging
                                        # print(f"--- DEBUG: Calculated fixed income '{linked_income_item.description}' for year {year}: {base_yearly_value:.2f} * {growth_factor:.4f} * {income_year_fraction:.4f} = {linked_income_flow_value:.2f} ---"); sys.stdout.flush()
                                
                                # Calculate expense as percentage of income (already prorated by income_year_fraction)
                                expense_amount = abs(linked_income_flow_value) * (exp_item.percentage / 100.0)
                                # Disabled verbose debug logging
                                # print(f"--- DEBUG: Dynamic expense '{exp_item.description}' ({exp_item.percentage}% of '{linked_income_item.description}' = {expense_amount:.2f}) contributing to asset '{target_asset.name}' ---"); sys.stdout.flush()
                                
                                # Store the expense amount in annual_flow_values for charts (as negative value for expenses)
                                # Use expense_year_fraction to prorate the expense amount for this year
                                annual_flow_values[exp_item.description] = -expense_amount
                    else:
                        # Fixed expense - calculate with growth
                        base_yearly_value = exp_item.yearly_value
                        effective_growth_rate = (exp_item.inflation_percent or 0) / 100.0
                        growth_factor = pow(1 + effective_growth_rate, year - 1)
                        expense_amount = base_yearly_value * growth_factor
                        # Prorate based on how many months the expense is active in this year
                        current_projection_year = current_year + year - 1
                        expense_year_fraction = calculate_year_fraction(
                            exp_item.start_date,
                            exp_item.end_date,
                            current_projection_year
                        )
                        expense_amount = expense_amount * expense_year_fraction
                        
                        # Store the expense amount in annual_flow_values for charts (as negative value for expenses)
                        annual_flow_values[exp_item.description] = -expense_amount
                    
                    # Add the expense amount to the asset balance
                    if expense_amount > 0:
                        balance_before_expense = account_current_balances.get(target_asset.name, 0.0)
                        account_current_balances[target_asset.name] += expense_amount
                        balance_after_expense = account_current_balances[target_asset.name]
                        # Disabled verbose debug logging
                        # print(f"--- DEBUG: Year {year} - Added expense contribution of {expense_amount:.2f} from '{exp_item.description}' to asset '{target_asset.name}'. Balance: {balance_before_expense:.2f} -> {balance_after_expense:.2f} ---"); sys.stdout.flush()
            
            # Calculate federal income tax if enabled
            federal_tax_expense_value = 0.0
            federal_tax_expense_account_name = None
            if calculate_federal_tax and user_settings:
                # Find the federal tax expense item (NEW: Use ID-based lookup where possible)
                # First try to find it in projected_accounts_for_db by cash_flow_item_id
                federal_tax_expense_item_id = None
                for acc in projected_accounts_for_db:
                    if acc.account_type == "expense" and acc.cash_flow_item_id:
                        cash_flow_item = cash_flow_items_by_id.get(acc.cash_flow_item_id)
                        if cash_flow_item and cash_flow_item.description == FEDERAL_TAX_EXPENSE_DESCRIPTION:
                            federal_tax_expense_item_id = acc.cash_flow_item_id
                            federal_tax_expense_account_name = acc.name
                            break
                
                # Fallback: query by description if not found in projected_accounts_for_db (shouldn't happen)
                federal_tax_expense_item = None
                if federal_tax_expense_item_id:
                    federal_tax_expense_item = cash_flow_items_by_id.get(federal_tax_expense_item_id)
                else:
                    federal_tax_expense_item = db.query(models.CashFlowItem).filter(
                        models.CashFlowItem.owner_id == owner_id,
                        models.CashFlowItem.is_income == False,
                        models.CashFlowItem.description == FEDERAL_TAX_EXPENSE_DESCRIPTION
                    ).first()
                
                if federal_tax_expense_item:
                    # Check if expense is active for this year
                    current_projection_year = current_year + year - 1
                    start_year = federal_tax_expense_item.start_date
                    end_year = federal_tax_expense_item.end_date
                    
                    if start_year:
                        try:
                            start_year_obj = datetime.strptime(start_year, "%Y-%m-%d").date()
                            if current_projection_year < start_year_obj.year:
                                federal_tax_expense_item = None  # Not active yet
                        except ValueError:
                            pass
                    if end_year and federal_tax_expense_item:
                        try:
                            end_year_obj = datetime.strptime(end_year, "%Y-%m-%d").date()
                            if current_projection_year > end_year_obj.year:
                                federal_tax_expense_item = None  # No longer active
                        except ValueError:
                            pass
                    
                    if federal_tax_expense_item:
                        # Calculate federal tax using the taxable income and tax-deductible expenses
                        # we tracked during the projection loop
                        print(f"--- DEBUG: Year {year} - Before tax calculation: current_year_taxable_income={current_year_taxable_income:.2f}, current_year_tax_deductible_expenses={current_year_tax_deductible_expenses:.2f} ---"); sys.stdout.flush()
                        if current_year_taxable_income > 0:
                            try:
                                print(f"--- DEBUG: Year {year} - Calling calculate_taxable_income with: income={current_year_taxable_income:.2f}, expenses={current_year_tax_deductible_expenses:.2f}, filing_status={user_settings.tax_filing_status or 'Single'}, year={current_projection_year}, qualified_dividends={current_year_qualified_dividends:.2f} ---"); sys.stdout.flush()
                                taxable_income_result, standard_deduction_result, tax_owed = calculate_taxable_income(
                                    current_year_taxable_income,
                                    current_year_tax_deductible_expenses,
                                    user_settings.tax_filing_status or "Single",
                                    user_settings.person1_birthdate,
                                    user_settings.person2_birthdate,
                                    current_projection_year,
                                    qualified_dividends=current_year_qualified_dividends
                                )
                                print(f"--- DEBUG: Year {year} - calculate_taxable_income returned: taxable_income={taxable_income_result:.2f}, standard_deduction={standard_deduction_result:.2f}, tax_owed={tax_owed:.2f} ---"); sys.stdout.flush()
                                federal_tax_expense_value = tax_owed or 0.0
                                
                                # Ensure we don't store -0.0 (negative zero) - convert to 0.0 for consistency
                                federal_tax_value = -federal_tax_expense_value if federal_tax_expense_value != 0.0 else 0.0
                                
                                # Use the account name we found earlier, or find it by name as fallback
                                if not federal_tax_expense_account_name:
                                    for acc in projected_accounts_for_db:
                                        if acc.account_type == "expense":
                                            display_name = acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name
                                            if display_name == FEDERAL_TAX_EXPENSE_DESCRIPTION:
                                                federal_tax_expense_account_name = acc.name
                                                break
                                
                                # Always store the tax value with the constant key first (ensures it's always available)
                                annual_flow_values[FEDERAL_TAX_EXPENSE_DESCRIPTION] = federal_tax_value
                                
                                # Update annual_flow_values for federal tax expense (negative for expenses)
                                # Store with account name if we found it (helps with lookup)
                                if federal_tax_expense_account_name:
                                    # Store with the account name (full name from projected_accounts_for_db)
                                    annual_flow_values[federal_tax_expense_account_name] = federal_tax_value
                                    # Also store with display_name (cleaned name) as fallback for chart matching
                                    display_name_for_tax = federal_tax_expense_account_name.split("|LINKED:")[0] if "|LINKED:" in federal_tax_expense_account_name else federal_tax_expense_account_name
                                    if "|LINKED_INCOME:" in display_name_for_tax:
                                        display_name_for_tax = display_name_for_tax.split("|LINKED_INCOME:")[0]
                                    # Always store with display_name as well (even if same as account_name) to ensure lookup works
                                    annual_flow_values[display_name_for_tax] = federal_tax_value
                                    print(f"--- DEBUG: Year {year} - Calculated federal tax: {federal_tax_expense_value:.2f}, stored value: {federal_tax_value:.2f}, stored with keys: '{federal_tax_expense_account_name}', '{display_name_for_tax}', '{FEDERAL_TAX_EXPENSE_DESCRIPTION}' ---"); sys.stdout.flush()
                                else:
                                    # Account name not found, but we still stored the value with the constant key
                                    print(f"--- DEBUG: Year {year} - Calculated federal tax: {federal_tax_expense_value:.2f}, stored value: {federal_tax_value:.2f}, stored with key: '{FEDERAL_TAX_EXPENSE_DESCRIPTION}' (account name not found in projected_accounts_for_db) ---"); sys.stdout.flush()
                                
                                # Update expense flow total
                                current_year_total_expense_flow -= federal_tax_expense_value  # Subtract because expenses are negative
                            except Exception as e:
                                print(f"--- WARNING: Error calculating federal tax for year {year}: {e} ---"); sys.stdout.flush()
                        else:
                            print(f"--- DEBUG: Year {year} - Skipping federal tax calculation: current_year_taxable_income={current_year_taxable_income:.2f} (must be > 0) ---"); sys.stdout.flush()
            
            # Calculate cash flow surplus/deficit and apply to designated asset
            net_cash_flow = current_year_total_income_flow + current_year_total_expense_flow
            surplus_deficit = current_year_total_income_flow - abs(current_year_total_expense_flow)
            
            # Apply surplus/deficit to designated asset if configured (before auto-disbursements)
            if surplus_asset_name and surplus_asset_name in account_current_balances:
                balance_before_surplus = account_current_balances[surplus_asset_name]
                account_current_balances[surplus_asset_name] += surplus_deficit
                balance_after_surplus = account_current_balances[surplus_asset_name]
                # Disabled verbose debug logging
                # print(f"--- DEBUG: Year {year} - {surplus_asset_name} - Balance before surplus: {balance_before_surplus:.2f}, Surplus added: {surplus_deficit:.2f}, Balance after surplus: {balance_after_surplus:.2f} ---"); sys.stdout.flush()

            # Apply auto-disbursement transfers
            year_start_date = date(current_year + year - 1, 1, 1)  # Start of current projection year (Jan 1)
            year_end_date = date(current_year + year - 1, 12, 31)  # End of current projection year (Dec 31)
            
            for disbursement in auto_disbursements:
                # Check if disbursement is active for this year
                active = True
                if disbursement.start_date:
                    try:
                        start_date_obj = datetime.strptime(disbursement.start_date, "%Y-%m-%d").date()
                        # Disbursement is not active if the year ends before the start_date
                        if year_end_date < start_date_obj:
                            active = False
                    except ValueError:
                        pass
                if disbursement.end_date and active:
                    try:
                        end_date_obj = datetime.strptime(disbursement.end_date, "%Y-%m-%d").date()
                        # Disbursement is not active if the year starts after the end_date
                        if year_start_date > end_date_obj:
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
                                balance_before_transfer = account_current_balances.get(target_name, 0.0)
                                account_current_balances[source_name] -= transfer_amount
                                account_current_balances[target_name] += transfer_amount
                                balance_after_transfer = account_current_balances[target_name]
                                # Disabled verbose debug logging
                                # print(f"--- DEBUG: Year {year} - Applied auto-disbursement: {transfer_amount:.2f} from {source_name} to {target_name}. {target_name} balance: {balance_before_transfer:.2f} -> {balance_after_transfer:.2f} ---"); sys.stdout.flush()

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
                # Also check for LINKED_INCOME marker
                if "|LINKED_INCOME:" in display_name:
                    display_name = display_name.split("|LINKED_INCOME:")[0]
                # For income/expense items, use annual flow value; for others, use account balance
                if acc.account_type in ["income", "expense"]:
                    # Try to get value using acc.name first, then try display_name as fallback
                    # This handles cases where the value might be stored with the cleaned name
                    value = annual_flow_values.get(acc.name, annual_flow_values.get(display_name, 0.0))
                    # Special case: If this is Federal Income Tax and value is still 0, try direct lookup
                    if value == 0.0 and display_name == FEDERAL_TAX_EXPENSE_DESCRIPTION:
                        # Try to find the value using any key that contains the description
                        for key, val in annual_flow_values.items():
                            if FEDERAL_TAX_EXPENSE_DESCRIPTION in key or key == FEDERAL_TAX_EXPENSE_DESCRIPTION:
                                value = val
                                print(f"--- DEBUG: Found Federal Income Tax value {value:.2f} using key '{key}' ---"); sys.stdout.flush()
                                break
                    account_values[f"{display_name}_Value"] = value
                else:
                    account_values[f"{display_name}_Value"] = account_current_balances.get(acc.name, 0.0)
            
            # Add principal/interest breakdown values
            account_values.update(account_values_for_year)
            
            # Ensure Federal Income Tax is always stored with the exact key the frontend expects
            # This handles cases where the Federal Tax expense item might have a different display_name
            if calculate_federal_tax:
                if FEDERAL_TAX_EXPENSE_DESCRIPTION in annual_flow_values:
                    federal_tax_value = annual_flow_values[FEDERAL_TAX_EXPENSE_DESCRIPTION]
                    # Ensure we don't store -0.0 (negative zero) - convert to 0.0 for consistency
                    if federal_tax_value == 0.0 or federal_tax_value == -0.0:
                        federal_tax_value = 0.0
                    federal_tax_key = f"{FEDERAL_TAX_EXPENSE_DESCRIPTION}_Value"
                    account_values[federal_tax_key] = federal_tax_value
                    print(f"--- DEBUG: Year {year} - Explicitly stored Federal Income Tax with key '{federal_tax_key}': {federal_tax_value:.2f} ---"); sys.stdout.flush()
                else:
                    # Tax calculation is enabled but value not found in annual_flow_values
                    # This might happen if tax calculation failed or wasn't executed
                    federal_tax_key = f"{FEDERAL_TAX_EXPENSE_DESCRIPTION}_Value"
                    account_values[federal_tax_key] = 0.0
                    print(f"--- WARNING: Year {year} - calculate_federal_tax is enabled but Federal Income Tax value not found in annual_flow_values. Setting to 0.0 ---"); sys.stdout.flush()
            
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


        # Final value is the net worth at the end of the last projected year
        final_value_projection = current_year_net_worth if years > 0 else sum(acc.initial_value for acc in projected_accounts_for_db)

        # Disabled verbose debug logging
        # print(f"--- DEBUG: Finished projection. Final Value: {final_value_projection}, Total Contributed: {total_contributed_overall}, Total Growth: {total_growth_overall} ---"); sys.stdout.flush()
        
        # Convert yearly_data_points to a list of dicts for JSON serialization
        data_for_json = [yearly_data_points[year] for year in sorted(yearly_data_points.keys())]
        data_json_string = json.dumps(data_for_json)

        # Return the structured data ready for database saving
        return {
            "final_value": final_value_projection,
            "total_contributed": total_contributed_overall,
            "total_growth": total_growth_overall,
            "projected_accounts": projected_accounts_for_db,
            "data_json": data_json_string # Include the JSON string of yearly data
        }
    except Exception as e:
        print(f"--- CRITICAL ERROR in calculate_projection: {e} (Traceback: {traceback.format_exc()}) ---"); sys.stdout.flush()
        raise e

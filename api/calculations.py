import json

from typing import List, Optional, Union
from sqlalchemy.orm import Session
import models
import schemas # Import schemas for type hinting
from datetime import date
from math import pow # NEW: For amortization calculation
from utils.tax_calculator import calculate_taxable_income, calculate_state_taxable_income # NEW: For federal and state tax calculation
from calculation_helpers import (
    apply_contributing_expenses_for_year,
    apply_reinvestment_for_year,
    apply_surplus_transfer_for_year,
    apply_taxes_for_year,
    build_account_values_for_year,
    compute_dynamic_cashflow,
    build_asset_name_by_id,
    build_assets_by_id,
    build_items_by_description,
    build_items_by_id,
    build_liabilities_by_name,
    recalculate_total_assets,
    build_year_bounds,
    calculate_year_fraction_dates,
    parse_date_value,
)
from utils.rmd import calculate_rmd

def calculate_year_fraction(start_date_str: Optional[Union[str, date]], end_date_str: Optional[Union[str, date]], projection_year: int) -> float:
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
    year_start = date(projection_year, 1, 1)
    year_end = date(projection_year, 12, 31)

    start_date_obj = parse_date_value(start_date_str)
    end_date_obj = parse_date_value(end_date_str)

    return calculate_year_fraction_dates(start_date_obj, end_date_obj, year_start, year_end)

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
        # Load user settings for surplus asset and other settings
        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == owner_id).first()
        surplus_asset_id = user_settings.surplus_asset_id if user_settings else None
        surplus_asset_name = None
        if surplus_asset_id:
            surplus_asset = db.query(models.Asset).filter(models.Asset.id == surplus_asset_id, models.Asset.owner_id == owner_id).first()
            if surplus_asset:
                surplus_asset_name = surplus_asset.name
        
        # Constants to identify tax expense items (DEPRECATED: Use cash_flow_item_id instead)
        FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)"
        STATE_TAX_EXPENSE_DESCRIPTION = "State Income Tax (Calculated)"
        
        # Check if tax calculations are enabled
        calculate_federal_tax = user_settings.calculate_federal_tax if user_settings else False
        calculate_state_tax = user_settings.calculate_state_tax if user_settings else False
        user_state = user_settings.state if user_settings else None
        
        # Pre-load CashFlowItems for tax calculation (keyed by ID for reliable lookup)
        # This replaces the fragile description-based matching with ID-based lookups
        cash_flow_items_by_id = {}
        cash_flow_items_by_description = {}
        all_cash_flow_items = []
        if db:
            all_cash_flow_items = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.owner_id == owner_id
            ).all()
            cash_flow_items_by_id = build_items_by_id(all_cash_flow_items)
            cash_flow_items_by_description = build_items_by_description(all_cash_flow_items)

        # Load auto-disbursement rules
        auto_disbursements = db.query(models.AutoDisbursement).filter(
            models.AutoDisbursement.owner_id == owner_id
        ).all() if db else []

        # Load assets to get account information (for retirement account rules)
        all_assets = db.query(models.Asset).filter(models.Asset.owner_id == owner_id).all() if db else []
        assets_by_id = build_assets_by_id(all_assets)
        asset_name_by_id = build_asset_name_by_id(all_assets)
        assets_by_name = {asset.name: asset for asset in all_assets}
        all_liabilities = db.query(models.Liability).filter(models.Liability.owner_id == owner_id).all() if db else []
        liabilities_by_name = build_liabilities_by_name(all_liabilities)
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

        projected_account_dates = {}
        projected_account_loan_start_dates = {}
        for projected_account in projected_accounts_for_db:
            projected_account_dates[projected_account.name] = (
                parse_date_value(projected_account.start_date),
                parse_date_value(projected_account.end_date),
            )
            projected_account_loan_start_dates[projected_account.name] = parse_date_value(
                projected_account.loan_start_date
            )

        cash_flow_item_dates_by_id = {}
        for item in all_cash_flow_items:
            cash_flow_item_dates_by_id[item.id] = (
                parse_date_value(item.start_date),
                parse_date_value(item.end_date),
            )

        auto_disbursements_prepared = []
        for disbursement in auto_disbursements:
            source_name = asset_name_by_id.get(disbursement.source_asset_id)
            target_name = asset_name_by_id.get(disbursement.target_asset_id)
            if not source_name or not target_name:
                continue
            auto_disbursements_prepared.append(
                (
                    source_name,
                    target_name,
                    disbursement.transfer_type,
                    disbursement.transfer_value,
                    parse_date_value(disbursement.start_date),
                    parse_date_value(disbursement.end_date),
                    getattr(disbursement, "distribution_type", None),
                    getattr(disbursement, "taxable_income_cashflow_item_id", None),
                    getattr(disbursement, "use_rmd", False),
                    getattr(disbursement, "rmd_overrides", None),
                )
            )

        contributing_expenses = [
            item for item in all_cash_flow_items if not item.is_income and item.contributes_to_asset_id
        ]
        contributing_income = [
            item
            for item in all_cash_flow_items
            if item.is_income
            and (
                item.contributes_to_asset_id
                or (item.reinvest_dividends and item.reinvestment_account_id)
            )
        ]

        # Get current year for accurate loan balance calculations
        current_year = date.today().year
        year_bounds = build_year_bounds(current_year, years)
        
        # Dictionary to hold current balances for each account, updated yearly
        # For income/expense items, initial_value is 0 (they don't have balances)
        # For assets/liabilities with start_date, initialize with 0 (they'll be initialized in their first active year)
        account_current_balances = {}
        for acc in projected_accounts_for_db:
            if acc.account_type in ["asset", "liability"] and acc.start_date:
                # Check if start_date is after the projection start year
                start_date_obj = projected_account_dates.get(acc.name, (None, None))[0]
                projection_start_year = date(current_year, 1, 1)
                if start_date_obj and start_date_obj > projection_start_year:
                    # Asset/liability starts mid-year, initialize with 0
                    account_current_balances[acc.name] = 0.0
                else:
                    # Asset/liability starts in first year or invalid date, use initial_value
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

            # Apply auto-disbursement transfers BEFORE growth calculations
            # Auto-disbursements happen at the beginning of the year, before assets grow
            # NOTE: Surplus/deficit transfers happen AFTER growth (at end of year) - see below
            current_projection_year, year_start_date, year_end_date = year_bounds[year - 1]
            
            # Apply auto-disbursements BEFORE growth
            for (
                source_name,
                target_name,
                transfer_type,
                transfer_value,
                disbursement_start_date,
                disbursement_end_date,
                distribution_type,
                taxable_cashflow_item_id,
                use_rmd,
                rmd_overrides,
            ) in auto_disbursements_prepared:
                # Check if disbursement is active for this year
                active = True
                if disbursement_start_date and year_end_date < disbursement_start_date:
                    active = False
                if disbursement_end_date and year_start_date > disbursement_end_date:
                    active = False
                
                if active:
                    # Find source and target asset names in projection
                    if source_name in account_current_balances and target_name in account_current_balances:
                        source_balance = account_current_balances[source_name]
                        
                        # Calculate transfer amount
                        # If configured to use RMD, compute RMD for this asset for the current_projection_year
                        if use_rmd and distribution_type == "taxable_ira":
                            # Find owner's birthdate from user_settings (already loaded)
                            if user_settings and user_settings.person1_birthdate:
                                rmd_info = calculate_rmd(user_settings.person1_birthdate, abs(source_balance), current_projection_year, user_settings.person2_birthdate if getattr(user_settings, 'person2_birthdate', None) else None)
                                # Check for per-year override (rmd_overrides may have string or int keys)
                                override_val = None
                                if rmd_overrides:
                                    # try int key first
                                    try:
                                        override_val = rmd_overrides.get(current_projection_year)
                                    except Exception:
                                        override_val = None
                                    if override_val is None:
                                        override_val = rmd_overrides.get(str(current_projection_year))
                                transfer_amount = float(override_val) if override_val is not None else rmd_info.get("rmd_amount", 0.0)
                            else:
                                # fallback to configured value if RMD cannot be computed
                                if transfer_type == "percentage":
                                    transfer_amount = abs(source_balance) * (transfer_value / 100.0)
                                else:
                                    transfer_amount = abs(transfer_value)
                        else:
                            if transfer_type == "percentage":
                                transfer_amount = abs(source_balance) * (transfer_value / 100.0)
                            else:  # dollar_amount
                                transfer_amount = abs(transfer_value)
                        
                        # Apply transfer (only if source has sufficient balance)
                        # This happens BEFORE growth, so source_balance is the beginning-of-year balance
                        if abs(source_balance) >= transfer_amount:
                            account_current_balances[source_name] -= transfer_amount
                            account_current_balances[target_name] += transfer_amount
                            # If this is a taxable IRA distribution, always record it as taxable income for the year.
                            # If a taxable_cashflow_item_id exists, also map the amount to that cashflow item for backward compatibility.
                            if distribution_type == "taxable_ira":
                                # Increase taxable income tracker so tax calc picks it up
                                current_year_taxable_income += transfer_amount
                                # If frontend previously created or linked a cashflow item, update annual_flow_values mapping too
                                if taxable_cashflow_item_id:
                                    cash_item = cash_flow_items_by_id.get(taxable_cashflow_item_id)
                                    if cash_item:
                                        desc = cash_item.description
                                        annual_flow_values[desc] = annual_flow_values.get(desc, 0.0) + transfer_amount

            for projected_account in projected_accounts_for_db:
                current_balance = account_current_balances[projected_account.name]
                
                # Check if item is active for this year and calculate proration fraction
                # This check must happen BEFORE calculating contributions so inactive items are skipped
                year_fraction = 1.0  # Default to full year if no dates
                is_active_for_year = True
                if projected_account.account_type in ["income", "expense", "asset", "liability"]:
                    start_date_obj, end_date_obj = projected_account_dates.get(
                        projected_account.name, (None, None)
                    )
                    year_fraction = calculate_year_fraction_dates(
                        start_date_obj, end_date_obj, year_start_date, year_end_date
                    )
                    is_active_for_year = year_fraction > 0.0
                
                # For assets/liabilities that start mid-year, initialize with initial_value in their first active year
                if projected_account.account_type in ["asset", "liability"] and is_active_for_year and current_balance == 0.0 and projected_account.start_date:
                    # This is the first year the asset/liability becomes active, initialize with initial_value
                    current_balance = projected_account.initial_value
                    account_current_balances[projected_account.name] = current_balance
                
                # Special handling for amortized loans
                if projected_account.account_type == "liability" and projected_account.loan_type == "amortized" and projected_account.principal_amount is not None and projected_account.interest_rate is not None and projected_account.loan_term_months is not None and projected_account.loan_start_date is not None:
                    loan_start_date_obj = projected_account_loan_start_dates.get(projected_account.name)
                    if loan_start_date_obj:
                        calculation_date_obj = year_end_date  # End of current projection year
                        
                        # Calculate principal/interest breakdown for this year
                        breakdown = calculate_annual_principal_interest(
                            principal=projected_account.principal_amount,
                            annual_interest_rate_percent=projected_account.interest_rate,
                            loan_term_months=projected_account.loan_term_months,
                            loan_start_date=loan_start_date_obj,
                            year=year
                        )
                        
                        # Get liability model to check options
                        liability = liabilities_by_name.get(projected_account.name)
                        
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

                    else:
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
                    
                    (
                        linked_asset_names,
                        linked_percentage,
                        linked_income_name,
                        base_account_name,
                        adjusted_annual_contribution,
                    ) = compute_dynamic_cashflow(
                        projected_account=projected_account,
                        is_active_for_year=is_active_for_year,
                        year_index=year,
                        year_start_date=year_start_date,
                        year_end_date=year_end_date,
                        account_current_balances=account_current_balances,
                        assets_by_id=assets_by_id,
                        assets_by_name=assets_by_name,
                        account_to_retirement_map=account_to_retirement_map,
                        cash_flow_items_by_description=cash_flow_items_by_description,
                        cash_flow_item_dates_by_id=cash_flow_item_dates_by_id,
                    )

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

                            # Try ID-based lookup first (preferred method)
                            if projected_account.cash_flow_item_id:
                                cash_flow_item = cash_flow_items_by_id.get(projected_account.cash_flow_item_id)
                            
                            # Fallback to description-based lookup for backward compatibility (old projections without cash_flow_item_id)
                            if not cash_flow_item and projected_account.account_type in ["income", "expense"]:
                                # Use base account name (remove LINKED markers) for lookup
                                cash_flow_item = cash_flow_items_by_description.get(base_item_name)
                            if cash_flow_item:
                                if projected_account.account_type == "income" and cash_flow_item.is_income:
                                    if cash_flow_item.taxable:
                                        # Use the absolute value (new_balance is positive for income)
                                        income_amount = abs(new_balance)
                                        current_year_taxable_income += income_amount
                                        lookup_method = f"ID:{projected_account.cash_flow_item_id}" if projected_account.cash_flow_item_id else f"description:{base_item_name}"
                                        # Track qualified dividends separately if applicable
                                        if cash_flow_item.is_qualified_dividend:
                                            current_year_qualified_dividends += income_amount
                                    else:
                                        lookup_method = f"ID:{projected_account.cash_flow_item_id}" if projected_account.cash_flow_item_id else f"description:{base_item_name}"
                                if projected_account.account_type == "expense" and not cash_flow_item.is_income:
                                    # Skip federal tax expense item itself (check by description for now, will be removed once frontend passes ID)
                                    if cash_flow_item.description != FEDERAL_TAX_EXPENSE_DESCRIPTION and cash_flow_item.tax_deductible:
                                        # Use the absolute value (new_balance is negative for expenses)
                                        current_year_tax_deductible_expenses += abs(new_balance)
                        
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
                        _, end_date_obj = projected_account_dates.get(projected_account.name, (None, None))
                        if projected_account.account_type in ["asset", "liability"] and projected_account.end_date:
                            # If end_date is in this year and before year end, store 0 (asset ends mid-year)
                            if end_date_obj and end_date_obj.year == current_projection_year and end_date_obj < year_end_date:
                                value_to_store = 0.0
                            else:
                                value_to_store = new_balance
                        else:
                            value_to_store = new_balance
                        
                        account_values_for_year[f"{projected_account.name}_Value"] = value_to_store
                        
                        # Update the stored value if this asset was affected by auto-disbursements
                        # (auto-disbursements were applied at the beginning of the year, so the final balance
                        # after growth will already reflect the transfer, but we need to ensure account_values_for_year
                        # has the correct end-of-year balance)
                        # Note: This is handled by the value_to_store calculation above, which uses new_balance
                        
                        # Update for next year's starting balance
                        # If item ends this year (year_fraction < 1.0 and end_date is in this year), 
                        # set balance to 0 for next year since asset no longer exists after end_date
                        if projected_account.account_type in ["asset", "liability"] and projected_account.end_date:
                            # If end_date is in this year and before year end, balance should be 0 next year
                            if end_date_obj and end_date_obj.year == current_projection_year and end_date_obj < year_end_date:
                                account_current_balances[projected_account.name] = 0.0
                            else:
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
                    # Check if this income item is reinvested (should not be counted in cash flow)
                    should_exclude_from_income_flow = False
                    if projected_account.cash_flow_item_id:
                        cash_flow_item_for_reinvest_check = cash_flow_items_by_id.get(projected_account.cash_flow_item_id)
                        if cash_flow_item_for_reinvest_check and cash_flow_item_for_reinvest_check.reinvest_dividends:
                            should_exclude_from_income_flow = True
                    else:
                        # Fallback: check by description for backward compatibility
                        # Extract base name from account name (remove LINKED markers)
                        base_item_name_for_check = projected_account.name.split("|LINKED:")[0].split("|LINKED_INCOME:")[0]
                        for item in cash_flow_items_by_id.values():
                            if item.description == base_item_name_for_check and item.reinvest_dividends:
                                should_exclude_from_income_flow = True
                                break
                    
                    # Only add to income flow if NOT reinvested (reinvested dividends go directly to assets, not cash flow)
                    if not should_exclude_from_income_flow:
                        # Use new_balance (prorated by year_fraction) instead of adjusted_annual_contribution (full year)
                        # new_balance is already prorated at lines 791 and 807 based on year_fraction
                        current_year_total_income_flow += abs(new_balance)  # new_balance is positive for income, but use abs() to be safe
                elif projected_account.account_type == "expense":
                    # Use new_balance (prorated by year_fraction) instead of adjusted_annual_contribution (full year)
                    # new_balance is negative for expenses, and we want to accumulate the absolute value for expense flow
                    current_year_total_expense_flow += new_balance  # new_balance is already negative for expenses

                # For contributions sum: use prorated values for income/expense items, full values for assets/liabilities
                # For income/expense: new_balance is the prorated flow value (already calculated with year_fraction)
                # For assets/liabilities: adjusted_annual_contribution represents actual contributions (deposits, withdrawals)
                if projected_account.account_type in ["income", "expense"]:
                    # Use new_balance (prorated) for income/expense items
                    current_year_contributions_sum += abs(new_balance)  # Use absolute value to track positive contributions
                else:
                    # For assets/liabilities, use adjusted_annual_contribution (actual contributions/deposits)
                    current_year_contributions_sum += adjusted_annual_contribution
                current_year_growth_sum += (growth_on_balance + growth_on_contributions)


            # Apply expenses that contribute to assets (must happen after expense flows are calculated)
            current_year_total_assets = apply_contributing_expenses_for_year(
                contributing_expenses=contributing_expenses,
                assets_by_id=assets_by_id,
                cash_flow_items_by_id=cash_flow_items_by_id,
                cash_flow_item_dates_by_id=cash_flow_item_dates_by_id,
                annual_flow_values=annual_flow_values,
                account_current_balances=account_current_balances,
                account_values_for_year=account_values_for_year,
                current_year_total_assets=current_year_total_assets,
                year_start_date=year_start_date,
                year_end_date=year_end_date,
                year_index=year,
            )

            # Apply income that contributes to assets (must happen after income flows are calculated and asset growth has been applied)
            # This handles dividend reinvestment where dividends are reinvested back into the asset
            current_year_total_assets = apply_reinvestment_for_year(
                contributing_income=contributing_income,
                assets_by_id=assets_by_id,
                cash_flow_item_dates_by_id=cash_flow_item_dates_by_id,
                account_current_balances=account_current_balances,
                account_values_for_year=account_values_for_year,
                current_year_total_assets=current_year_total_assets,
                year_start_date=year_start_date,
                year_end_date=year_end_date,
                year_index=year,
            )

            current_year_total_expense_flow, federal_tax_expense_value = apply_taxes_for_year(
                calculate_federal_tax=calculate_federal_tax,
                calculate_state_tax=calculate_state_tax,
                user_settings=user_settings,
                user_state=user_state,
                projected_accounts_for_db=projected_accounts_for_db,
                cash_flow_items_by_id=cash_flow_items_by_id,
                cash_flow_items_by_description=cash_flow_items_by_description,
                cash_flow_item_dates_by_id=cash_flow_item_dates_by_id,
                current_projection_year=current_projection_year,
                current_year_taxable_income=current_year_taxable_income,
                current_year_tax_deductible_expenses=current_year_tax_deductible_expenses,
                current_year_qualified_dividends=current_year_qualified_dividends,
                annual_flow_values=annual_flow_values,
                current_year_total_expense_flow=current_year_total_expense_flow,
                federal_tax_expense_description=FEDERAL_TAX_EXPENSE_DESCRIPTION,
                state_tax_expense_description=STATE_TAX_EXPENSE_DESCRIPTION,
                calculate_taxable_income=calculate_taxable_income,
                calculate_state_taxable_income=calculate_state_taxable_income,
            )
            
            # Calculate and apply surplus/deficit transfer AFTER growth calculations
            # Surplus/deficit transfers happen at the end of the year, after all assets have grown
            # This represents the cash flow surplus/deficit for the year being moved to the surplus asset
            net_cash_flow, surplus_deficit = apply_surplus_transfer_for_year(
                surplus_asset_name=surplus_asset_name,
                account_current_balances=account_current_balances,
                account_values_for_year=account_values_for_year,
                current_year_total_income_flow=current_year_total_income_flow,
                current_year_total_expense_flow=current_year_total_expense_flow,
            )

            # Note: The calculation sequence is:
            # 1. Beginning of year: Apply auto-disbursements (transfers between assets before growth)
            # 2. During loop: Apply growth to all assets
            # 3. After loop: Calculate income/expense flows and apply surplus/deficit transfer (end of year)
            # This ensures:
            # - Auto-disbursements benefit from the same year's growth
            # - Surplus/deficit is calculated from actual income/expense totals (including dynamic items)
            # - Surplus/deficit is added after assets have grown, representing end-of-year cash flow transfer
            # - Auto-disbursements involving the surplus asset operate on the beginning-of-year balance (before surplus is added)

            # Recalculate totals after surplus/deficit (auto-disbursements already applied before growth)
            # This ensures assets reflect the transfers
            current_year_total_assets = recalculate_total_assets(
                projected_accounts_for_db=projected_accounts_for_db,
                account_current_balances=account_current_balances,
            )

            # Update overall totals
            total_contributed_overall += current_year_contributions_sum
            total_growth_overall += current_year_growth_sum

            # Add overall totals to time series data for the current year
            current_year_net_worth = current_year_total_assets + current_year_total_liabilities

            # Build yearly data points, cleaning up account names for display (remove LINKED markers)
            account_values = build_account_values_for_year(
                projected_accounts_for_db=projected_accounts_for_db,
                annual_flow_values=annual_flow_values,
                account_current_balances=account_current_balances,
                account_values_for_year=account_values_for_year,
                calculate_federal_tax=calculate_federal_tax,
                federal_tax_expense_description=FEDERAL_TAX_EXPENSE_DESCRIPTION,
            )
            
            checking_value_key = "Comp Test Checking_Value"
            if checking_value_key in account_values:
                checking_final_value = account_values[checking_value_key]
            
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
            
            if checking_value_key in yearly_data_points[year]:
                stored_value = yearly_data_points[year][checking_value_key]


        # Final value is the net worth at the end of the last projected year
        final_value_projection = current_year_net_worth if years > 0 else sum(acc.initial_value for acc in projected_accounts_for_db)

        
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
        raise e

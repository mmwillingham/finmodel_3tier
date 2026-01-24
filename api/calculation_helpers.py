from datetime import date, datetime
from typing import Dict, Iterable, List, Optional, Tuple, Callable


def parse_date_value(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    try:
        return datetime.strptime(stripped, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def build_year_bounds(start_year: int, years: int) -> List[Tuple[int, date, date]]:
    return [
        (start_year + offset, date(start_year + offset, 1, 1), date(start_year + offset, 12, 31))
        for offset in range(years)
    ]


def calculate_year_fraction_dates(
    start_date: Optional[date],
    end_date: Optional[date],
    year_start: date,
    year_end: date,
) -> float:
    if start_date is not None and end_date is not None and start_date == end_date:
        return 1.0 if year_start <= start_date <= year_end else 0.0

    item_start = start_date if start_date and start_date > year_start else year_start
    item_end = end_date if end_date and end_date < year_end else year_end

    if item_end < year_start or item_start > year_end:
        return 0.0

    if item_start == item_end and year_start <= item_start <= year_end:
        return 1.0

    overlap_days = (item_end - item_start).days + 1
    days_in_year = (year_end - year_start).days + 1
    if days_in_year <= 0:
        return 0.0

    fraction = overlap_days / days_in_year
    return max(0.0, min(1.0, fraction))


def build_items_by_id(items: Iterable) -> Dict[int, object]:
    return {item.id: item for item in items}


def build_items_by_description(items: Iterable) -> Dict[str, object]:
    items_by_description: Dict[str, object] = {}
    for item in items:
        if item.description not in items_by_description:
            items_by_description[item.description] = item
    return items_by_description


def build_assets_by_id(items: Iterable) -> Dict[int, object]:
    return {item.id: item for item in items}


def build_asset_name_by_id(items: Iterable) -> Dict[int, str]:
    return {item.id: item.name for item in items}


def build_liabilities_by_name(items: Iterable) -> Dict[str, object]:
    return {item.name: item for item in items}


class ProjectionTaxError(RuntimeError):
    pass


def apply_contributing_expenses_for_year(
    *,
    contributing_expenses: Iterable,
    assets_by_id: Dict[int, object],
    cash_flow_items_by_id: Dict[int, object],
    cash_flow_item_dates_by_id: Dict[int, Tuple[Optional[date], Optional[date]]],
    annual_flow_values: Dict[str, float],
    account_current_balances: Dict[str, float],
    account_values_for_year: Dict[str, float],
    current_year_total_assets: float,
    year_start_date: date,
    year_end_date: date,
    year_index: int,
) -> float:
    for exp_item in contributing_expenses:
        # Check if expense is active for this year and calculate proration
        start_date_obj, end_date_obj = cash_flow_item_dates_by_id.get(
            exp_item.id, (None, None)
        )
        expense_year_fraction = calculate_year_fraction_dates(
            start_date_obj, end_date_obj, year_start_date, year_end_date
        )

        if expense_year_fraction <= 0.0:
            continue  # Skip this expense for this year

        # Find the target asset
        target_asset = assets_by_id.get(exp_item.contributes_to_asset_id)
        if not target_asset or target_asset.name not in account_current_balances:
            continue

        # Calculate the expense amount for this year
        expense_amount = 0.0

        # Check if this expense is in the projection accounts (for dynamic items)
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
                linked_income_item = cash_flow_items_by_id.get(exp_item.linked_item_id)
                if linked_income_item:
                    # Check if income item is active for this year first
                    start_date_obj, end_date_obj = cash_flow_item_dates_by_id.get(
                        linked_income_item.id, (None, None)
                    )
                    income_year_fraction = calculate_year_fraction_dates(
                        start_date_obj, end_date_obj, year_start_date, year_end_date
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
                                    linked_asset = assets_by_id.get(asset_id)
                                    if linked_asset and linked_asset.name in account_current_balances:
                                        total_linked_asset_value += abs(account_current_balances[linked_asset.name])

                                if total_linked_asset_value > 0:
                                    linked_income_flow_value = total_linked_asset_value * (linked_income_item.percentage / 100.0) * income_year_fraction
                        else:
                            # Fixed income item - calculate with growth for this specific year
                            base_yearly_value = linked_income_item.yearly_value
                            effective_growth_rate = (linked_income_item.annual_increase_percent or 0) / 100.0
                            growth_factor = pow(1 + effective_growth_rate, year_index - 1)
                            linked_income_flow_value = base_yearly_value * growth_factor * income_year_fraction

                    # Calculate expense as percentage of income (already prorated by income_year_fraction)
                    expense_amount = abs(linked_income_flow_value) * (exp_item.percentage / 100.0)
                    # Apply expense_year_fraction to further restrict the expense if it has its own start/end dates
                    # This ensures the expense is prorated by its own active period, which may be more restrictive than the income's period
                    expense_amount = expense_amount * expense_year_fraction

                    # Store the expense amount in annual_flow_values for charts (as negative value for expenses)
                    annual_flow_values[exp_item.description] = -expense_amount
        else:
            # Fixed expense - calculate with growth
            base_yearly_value = exp_item.yearly_value
            effective_growth_rate = (exp_item.inflation_percent or 0) / 100.0
            growth_factor = pow(1 + effective_growth_rate, year_index - 1)
            expense_amount = base_yearly_value * growth_factor
            # Prorate based on how many months the expense is active in this year
            expense_year_fraction = calculate_year_fraction_dates(
                start_date_obj, end_date_obj, year_start_date, year_end_date
            )
            expense_amount = expense_amount * expense_year_fraction

            # Store the expense amount in annual_flow_values for charts (as negative value for expenses)
            annual_flow_values[exp_item.description] = -expense_amount

        # Add the expense amount to the asset balance
        if expense_amount > 0:
            account_current_balances[target_asset.name] += expense_amount
            # Update the stored value for this asset in account_values_for_year to include the contribution
            # This ensures charts show the correct end-of-year balance including contributions
            asset_value_key = f"{target_asset.name}_Value"
            if asset_value_key in account_values_for_year:
                account_values_for_year[asset_value_key] = account_current_balances[target_asset.name]
            # Update current_year_total_assets to include the contribution
            # This ensures balance sheet projections show correct totals
            current_year_total_assets += expense_amount

    return current_year_total_assets


def apply_reinvestment_for_year(
    *,
    contributing_income: Iterable,
    assets_by_id: Dict[int, object],
    cash_flow_item_dates_by_id: Dict[int, Tuple[Optional[date], Optional[date]]],
    account_current_balances: Dict[str, float],
    account_values_for_year: Dict[str, float],
    current_year_total_assets: float,
    year_start_date: date,
    year_end_date: date,
    year_index: int,
) -> float:
    for income_item in contributing_income:
        # Check if income is active for this year and calculate proration
        start_date_obj, end_date_obj = cash_flow_item_dates_by_id.get(
            income_item.id, (None, None)
        )
        income_year_fraction = calculate_year_fraction_dates(
            start_date_obj, end_date_obj, year_start_date, year_end_date
        )

        if income_year_fraction <= 0.0:
            continue  # Skip this income for this year

        # Find the target asset - prefer contributes_to_asset_id, fallback to reinvestment_account_id
        target_asset_id = income_item.contributes_to_asset_id or income_item.reinvestment_account_id
        if not target_asset_id:
            continue

        target_asset = assets_by_id.get(target_asset_id)
        if not target_asset or target_asset.name not in account_current_balances:
            continue

        # Calculate the income amount for this year
        # For dividend reinvestment, dividends are calculated from the beginning-of-year asset balance
        # At this point, account_current_balances has the end-of-year balance (after growth)
        # We reverse the growth to get the beginning-of-year balance, then calculate dividend
        income_amount = 0.0

        if income_item.linked_item_type == "asset" and income_item.percentage is not None:
            # Dynamic dividend item: Calculate from beginning-of-year asset balance
            # Reverse the growth to get beginning balance: beginning = current / (1 + growth_rate)
            current_balance = account_current_balances.get(target_asset.name, 0.0)
            if current_balance > 0:
                effective_growth_rate = (target_asset.annual_increase_percent or 0) / 100.0
                beginning_balance = current_balance / pow(1 + effective_growth_rate, 1.0)  # Full year growth
                income_amount = beginning_balance * (income_item.percentage / 100.0) * income_year_fraction
        else:
            # Fixed income item - calculate with growth
            base_yearly_value = income_item.yearly_value
            effective_growth_rate = (income_item.annual_increase_percent or 0) / 100.0
            growth_factor = pow(1 + effective_growth_rate, year_index - 1)
            income_amount = base_yearly_value * growth_factor
            # Prorate based on how many months the income is active in this year
            income_amount = income_amount * income_year_fraction

        # Add the income amount to the asset balance (dividend reinvestment)
        if income_amount > 0:
            account_current_balances[target_asset.name] += income_amount
            # Update the stored value for this asset in account_values_for_year to include the contribution
            # This ensures charts show the correct end-of-year balance including dividend reinvestment
            asset_value_key = f"{target_asset.name}_Value"
            if asset_value_key in account_values_for_year:
                account_values_for_year[asset_value_key] = account_current_balances[target_asset.name]
            # Update current_year_total_assets to include the contribution
            # This ensures balance sheet projections show correct totals
            current_year_total_assets += income_amount

    return current_year_total_assets


def apply_taxes_for_year(
    *,
    calculate_federal_tax: bool,
    calculate_state_tax: bool,
    user_settings: object,
    user_state: Optional[str],
    projected_accounts_for_db: Iterable,
    cash_flow_items_by_id: Dict[int, object],
    cash_flow_items_by_description: Dict[str, object],
    cash_flow_item_dates_by_id: Dict[int, Tuple[Optional[date], Optional[date]]],
    current_projection_year: int,
    current_year_taxable_income: float,
    current_year_tax_deductible_expenses: float,
    current_year_qualified_dividends: float,
    annual_flow_values: Dict[str, float],
    current_year_total_expense_flow: float,
    federal_tax_expense_description: str,
    state_tax_expense_description: str,
    calculate_taxable_income: Callable,
    calculate_state_taxable_income: Callable,
) -> Tuple[float, float]:
    federal_tax_expense_value = 0.0
    federal_tax_expense_account_name = None
    if calculate_federal_tax and user_settings:
        # Find the federal tax expense item (NEW: Use ID-based lookup where possible)
        # First try to find it in projected_accounts_for_db by cash_flow_item_id
        federal_tax_expense_item_id = None
        for acc in projected_accounts_for_db:
            if acc.account_type == "expense" and acc.cash_flow_item_id:
                cash_flow_item = cash_flow_items_by_id.get(acc.cash_flow_item_id)
                if cash_flow_item and cash_flow_item.description == federal_tax_expense_description:
                    federal_tax_expense_item_id = acc.cash_flow_item_id
                    federal_tax_expense_account_name = acc.name
                    break

        # Fallback: lookup by description if not found in projected_accounts_for_db (shouldn't happen)
        federal_tax_expense_item = None
        if federal_tax_expense_item_id:
            federal_tax_expense_item = cash_flow_items_by_id.get(federal_tax_expense_item_id)
        else:
            federal_tax_expense_item = cash_flow_items_by_description.get(federal_tax_expense_description)
            if federal_tax_expense_item and federal_tax_expense_item.is_income:
                federal_tax_expense_item = None

        if federal_tax_expense_item:
            # Check if expense is active for this year
            start_date_obj, end_date_obj = cash_flow_item_dates_by_id.get(
                federal_tax_expense_item.id, (None, None)
            )
            if start_date_obj and current_projection_year < start_date_obj.year:
                federal_tax_expense_item = None  # Not active yet
            if end_date_obj and federal_tax_expense_item and current_projection_year > end_date_obj.year:
                federal_tax_expense_item = None  # No longer active

            if federal_tax_expense_item:
                # Calculate federal tax using the taxable income and tax-deductible expenses
                # we tracked during the projection loop
                if current_year_taxable_income > 0:
                    try:
                        # Use tax_year from settings, or default to projection year if not set
                        # Note: Only 2025 tax brackets are currently implemented
                        tax_year_for_calc = user_settings.tax_year if user_settings and user_settings.tax_year else current_projection_year
                        _, _, tax_owed = calculate_taxable_income(
                            current_year_taxable_income,
                            current_year_tax_deductible_expenses,
                            user_settings.tax_filing_status or "Single",
                            user_settings.person1_birthdate,
                            user_settings.person2_birthdate,
                            tax_year_for_calc,  # Use tax_year from settings
                            qualified_dividends=current_year_qualified_dividends
                        )
                        federal_tax_expense_value = tax_owed or 0.0

                        # Ensure we don't store -0.0 (negative zero) - convert to 0.0 for consistency
                        federal_tax_value = -federal_tax_expense_value if federal_tax_expense_value != 0.0 else 0.0

                        # Use the account name we found earlier, or find it by name as fallback
                        if not federal_tax_expense_account_name:
                            for acc in projected_accounts_for_db:
                                if acc.account_type == "expense":
                                    display_name = acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name
                                    if display_name == federal_tax_expense_description:
                                        federal_tax_expense_account_name = acc.name
                                        break

                        # Always store the tax value with the constant key first (ensures it's always available)
                        annual_flow_values[federal_tax_expense_description] = federal_tax_value

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

                        # Update expense flow total
                        current_year_total_expense_flow -= federal_tax_expense_value  # Subtract because expenses are negative
                    except Exception as exc:
                        raise ProjectionTaxError("Failed to calculate federal tax") from exc

    # Calculate state income tax if enabled (similar to federal tax)
    state_tax_expense_value = 0.0
    state_tax_expense_account_name = None
    if calculate_state_tax and user_settings and user_state:
        # Find the state tax expense item (similar to federal tax)
        state_tax_expense_item_id = None
        for acc in projected_accounts_for_db:
            if acc.account_type == "expense" and acc.cash_flow_item_id:
                cash_flow_item = cash_flow_items_by_id.get(acc.cash_flow_item_id)
                if cash_flow_item and cash_flow_item.description == state_tax_expense_description:
                    state_tax_expense_item_id = acc.cash_flow_item_id
                    state_tax_expense_account_name = acc.name
                    break

        # Fallback: lookup by description if not found in projected_accounts_for_db
        state_tax_expense_item = None
        if state_tax_expense_item_id:
            state_tax_expense_item = cash_flow_items_by_id.get(state_tax_expense_item_id)
        else:
            state_tax_expense_item = cash_flow_items_by_description.get(state_tax_expense_description)
            if state_tax_expense_item and state_tax_expense_item.is_income:
                state_tax_expense_item = None

        if state_tax_expense_item:
            # Check if expense is active for this year
            start_date_obj, end_date_obj = cash_flow_item_dates_by_id.get(
                state_tax_expense_item.id, (None, None)
            )
            if start_date_obj and current_projection_year < start_date_obj.year:
                state_tax_expense_item = None  # Not active yet
            if end_date_obj and state_tax_expense_item and current_projection_year > end_date_obj.year:
                state_tax_expense_item = None  # No longer active

            if state_tax_expense_item:
                # Calculate state tax using the taxable income and tax-deductible expenses
                # we tracked during the projection loop (same as federal tax)
                if current_year_taxable_income > 0:
                    try:
                        # Use tax_year from settings, or default to projection year if not set
                        # Note: Only 2025 tax brackets are currently implemented
                        tax_year_for_state_calc = user_settings.tax_year if user_settings and user_settings.tax_year else current_projection_year
                        _, _, state_tax_owed = calculate_state_taxable_income(
                            total_income=current_year_taxable_income + current_year_tax_deductible_expenses,  # Add back deductions to get total income
                            tax_deductible_expenses=current_year_tax_deductible_expenses,
                            state=user_state,
                            filing_status=user_settings.tax_filing_status if user_settings else "Single",
                            federal_tax_owed=federal_tax_expense_value,  # Pass federal tax for states that allow deduction
                            current_year=tax_year_for_state_calc  # Use tax_year from settings
                        )
                        state_tax_expense_value = state_tax_owed or 0.0

                        # Ensure we don't store -0.0 (negative zero) - convert to 0.0 for consistency
                        state_tax_value = -state_tax_expense_value if state_tax_expense_value != 0.0 else 0.0

                        # Use the account name we found earlier, or find it by name as fallback
                        if not state_tax_expense_account_name:
                            for acc in projected_accounts_for_db:
                                if acc.account_type == "expense":
                                    display_name = acc.name.split("|LINKED:")[0] if "|LINKED:" in acc.name else acc.name
                                    if display_name == state_tax_expense_description:
                                        state_tax_expense_account_name = acc.name
                                        break

                        # Always store the tax value with the constant key first (ensures it's always available)
                        annual_flow_values[state_tax_expense_description] = state_tax_value

                        # Update annual_flow_values for state tax expense (negative for expenses)
                        # Store with account name if we found it (helps with lookup)
                        if state_tax_expense_account_name:
                            # Store with the account name (full name from projected_accounts_for_db)
                            annual_flow_values[state_tax_expense_account_name] = state_tax_value
                            # Also store with display_name (cleaned name) as fallback for chart matching
                            display_name_for_tax = state_tax_expense_account_name.split("|LINKED:")[0] if "|LINKED:" in state_tax_expense_account_name else state_tax_expense_account_name
                            if "|LINKED_INCOME:" in display_name_for_tax:
                                display_name_for_tax = display_name_for_tax.split("|LINKED_INCOME:")[0]
                            # Always store with display_name as well (even if same as account_name) to ensure lookup works
                            annual_flow_values[display_name_for_tax] = state_tax_value

                        # Update expense flow total
                        current_year_total_expense_flow -= state_tax_expense_value  # Subtract because expenses are negative
                    except Exception as exc:
                        raise ProjectionTaxError("Failed to calculate state tax") from exc

    return current_year_total_expense_flow, federal_tax_expense_value


def compute_dynamic_cashflow(
    *,
    projected_account,
    is_active_for_year: bool,
    year_index: int,
    year_start_date: date,
    year_end_date: date,
    account_current_balances: Dict[str, float],
    assets_by_id: Dict[int, object],
    assets_by_name: Dict[str, object],
    account_to_retirement_map: Dict[int, bool],
    cash_flow_items_by_description: Dict[str, object],
    cash_flow_item_dates_by_id: Dict[int, Tuple[Optional[date], Optional[date]]],
) -> Tuple[List[str], Optional[float], Optional[str], str, float]:
    # Check if this is a dynamic cashflow item (linked to an asset or income)
    # Format: "ItemName|LINKED:AssetName|PERCENTAGE:10.0" (single asset)
    # Format: "ItemName|LINKED:Asset1,Asset2,Asset3|PERCENTAGE:10.0" (multiple assets)
    # Format: "ItemName|LINKED_INCOME:IncomeItemName|PERCENTAGE:10.0" (linked to income)
    linked_asset_names: List[str] = []
    linked_percentage: Optional[float] = None
    linked_income_name: Optional[str] = None
    base_account_name = projected_account.name

    # Check for expense linked to income
    if "|LINKED_INCOME:" in projected_account.name and "|PERCENTAGE:" in projected_account.name and projected_account.account_type == "expense":
        parts = projected_account.name.split("|LINKED_INCOME:")
        if len(parts) == 2:
            base_account_name = parts[0]
            rest = parts[1]
            percent_parts = rest.split("|PERCENTAGE:")
            if len(percent_parts) == 2:
                linked_income_name = percent_parts[0].strip()
                try:
                    linked_percentage = float(percent_parts[1])
                except ValueError:
                    linked_percentage = None

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

        linked_income_item = cash_flow_items_by_description.get(linked_income_name)
        if linked_income_item and not linked_income_item.is_income:
            linked_income_item = None

        if linked_income_item:
            start_date_obj, end_date_obj = cash_flow_item_dates_by_id.get(
                linked_income_item.id, (None, None)
            )
            income_year_fraction = calculate_year_fraction_dates(
                start_date_obj, end_date_obj, year_start_date, year_end_date
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
                            asset = assets_by_id.get(asset_id)
                            if asset and asset.name in account_current_balances:
                                total_linked_asset_value += abs(account_current_balances[asset.name])

                        if total_linked_asset_value > 0:
                            linked_income_flow_value = total_linked_asset_value * (linked_income_item.percentage / 100.0) * income_year_fraction
                else:
                    # Fixed income - calculate with growth for this specific year
                    base_yearly_value = linked_income_item.yearly_value
                    effective_growth_rate = (linked_income_item.annual_increase_percent or 0) / 100.0
                    growth_factor = pow(1 + effective_growth_rate, year_index - 1)
                    linked_income_flow_value = base_yearly_value * growth_factor * income_year_fraction

        # Calculate expense as percentage of income
        expense_amount = abs(linked_income_flow_value) * (linked_percentage / 100.0)
        adjusted_annual_contribution = -expense_amount  # Negative for expense
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
                asset = assets_by_name.get(linked_asset_name)
                if asset:
                    linked_assets_found.append(asset)

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

                else:
                    # For non-retirement accounts, dividends/interest are available for spending
                    adjusted_annual_contribution = yearly_value
            else:
                # Expenses (shouldn't normally be dynamic, but handle if needed)
                adjusted_annual_contribution = -yearly_value
        else:
            # Linked assets not found in projection, use 0
            adjusted_annual_contribution = 0.0
    else:
        # Fixed contribution item
        # Skip calculation if item is not active for this year (for income/expense items)
        if not is_active_for_year and projected_account.account_type in ["income", "expense"]:
            adjusted_annual_contribution = 0.0
        else:
            # Check if this is a one-time expense/income (start_date == end_date)
            is_one_time = (projected_account.start_date and 
                         projected_account.end_date and 
                         projected_account.start_date == projected_account.end_date and
                         projected_account.account_type in ["income", "expense"])

            if is_one_time:
                # For one-time items, contribution is already set to yearly_value/12 by frontend,
                # but we should treat it as the full amount for that year
                # Multiply by 12 to get the full amount (since frontend divides by 12)
                # This will then be multiplied by year_fraction (1.0 for one-time) to get the full value
                adjusted_annual_contribution = projected_account.contribution * 12
            else:
                # For recurring items (monthly/yearly), contribution is monthly, multiply by 12 to get annual
                adjusted_annual_contribution = projected_account.contribution * 12

            # Contributions to liabilities/expenses are negative cash flow
            if projected_account.account_type in ["liability", "expense"]:
                adjusted_annual_contribution = -abs(adjusted_annual_contribution) if adjusted_annual_contribution > 0 else adjusted_annual_contribution
            elif projected_account.account_type == "income":
                 adjusted_annual_contribution = abs(adjusted_annual_contribution)

    return (
        linked_asset_names,
        linked_percentage,
        linked_income_name,
        base_account_name,
        adjusted_annual_contribution,
    )


def apply_surplus_transfer_for_year(
    *,
    surplus_asset_name: Optional[str],
    account_current_balances: Dict[str, float],
    account_values_for_year: Dict[str, float],
    current_year_total_income_flow: float,
    current_year_total_expense_flow: float,
) -> Tuple[float, float]:
    net_cash_flow = current_year_total_income_flow + current_year_total_expense_flow
    surplus_deficit = current_year_total_income_flow - abs(current_year_total_expense_flow)

    # Apply surplus/deficit to designated asset AFTER growth
    # NOTE: This happens after growth, so the surplus asset has already grown on its beginning balance
    # The surplus/deficit is then added to the end-of-year balance
    if surplus_asset_name and surplus_asset_name in account_current_balances:
        account_current_balances[surplus_asset_name] += surplus_deficit

        # Update the stored value in account_values_for_year to include the surplus/deficit
        # This ensures charts show the correct end-of-year balance after surplus/deficit transfer
        surplus_value_key = f"{surplus_asset_name}_Value"
        # Always set/update the surplus asset value in account_values_for_year, even if key doesn't exist
        # This handles cases where the asset might not have been set during the growth loop (e.g., partial year assets)
        account_values_for_year[surplus_value_key] = account_current_balances[surplus_asset_name]

    return net_cash_flow, surplus_deficit


def recalculate_total_assets(
    *,
    projected_accounts_for_db: Iterable,
    account_current_balances: Dict[str, float],
) -> float:
    total_assets = 0.0
    for acc in projected_accounts_for_db:
        if acc.account_type == "asset" and acc.name in account_current_balances:
            total_assets += account_current_balances[acc.name]
    return total_assets


def build_account_values_for_year(
    *,
    projected_accounts_for_db: Iterable,
    annual_flow_values: Dict[str, float],
    account_current_balances: Dict[str, float],
    account_values_for_year: Dict[str, float],
    calculate_federal_tax: bool,
    federal_tax_expense_description: str,
) -> Dict[str, float]:
    account_values: Dict[str, float] = {}
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
            if value == 0.0 and display_name == federal_tax_expense_description:
                # Try to find the value using any key that contains the description
                for key, val in annual_flow_values.items():
                    if federal_tax_expense_description in key or key == federal_tax_expense_description:
                        value = val
                        break
            account_values[f"{display_name}_Value"] = value
        else:
            # For assets/liabilities, use account_current_balances (which has the final balance after surplus)
            # Only use account_values_for_year if the account isn't in account_current_balances (shouldn't happen)
            if acc.name in account_current_balances:
                balance_value = account_current_balances[acc.name]
                account_values[f"{display_name}_Value"] = balance_value
            else:
                # Fallback: try account_values_for_year if account_current_balances doesn't have it
                fallback_value = account_values_for_year.get(f"{acc.name}_Value", 0.0)
                account_values[f"{display_name}_Value"] = fallback_value

    # Add principal/interest breakdown values (for loans) and any other breakdown values
    # BUT: Don't overwrite asset/liability _Value keys that we just set from account_current_balances
    # Only add keys that aren't already in account_values (like _Principal, _Interest, _Payment)
    for key, value in account_values_for_year.items():
        # Only add keys that are not _Value keys for assets/liabilities (to avoid overwriting correct balances)
        # Keep _Principal, _Interest, _Payment, and other breakdown values
        if not key.endswith("_Value") or key not in account_values:
            account_values[key] = value

    # Ensure Federal Income Tax is always stored with the exact key the frontend expects
    # This handles cases where the Federal Tax expense item might have a different display_name
    if calculate_federal_tax:
        if federal_tax_expense_description in annual_flow_values:
            federal_tax_value = annual_flow_values[federal_tax_expense_description]
            # Ensure we don't store -0.0 (negative zero) - convert to 0.0 for consistency
            if federal_tax_value == 0.0 or federal_tax_value == -0.0:
                federal_tax_value = 0.0
            federal_tax_key = f"{federal_tax_expense_description}_Value"
            account_values[federal_tax_key] = federal_tax_value
        else:
            # Tax calculation is enabled but value not found in annual_flow_values
            # This might happen if tax calculation failed or wasn't executed
            federal_tax_key = f"{federal_tax_expense_description}_Value"
            account_values[federal_tax_key] = 0.0

    return account_values

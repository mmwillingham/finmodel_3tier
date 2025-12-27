# api/calculations.py

import pandas as pd
import json
from typing import List, Optional
from sqlalchemy.orm import Session
import models # Adjust import for models

def calculate_projection(years: int, accounts: list, db: Session, owner_id: int) -> dict:
    """
    Calculates the financial projection, tracking balances for each account yearly.
    Includes dynamic calculation of cash flow items linked to other assets/income/expenses.
    """
    print(f"DEBUG: ENTERED CALCULATIONS.PY: calculate_projection function for owner {owner_id}")
    
    # 1. Fetch all relevant items for the owner
    all_assets = db.query(models.Asset).filter(models.Asset.owner_id == owner_id).all()
    all_liabilities = db.query(models.Liability).filter(models.Liability.owner_id == owner_id).all()
    all_cashflow_items = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == owner_id).all()

    print(f"DEBUG: Fetched {len(all_assets)} assets, {len(all_liabilities)} liabilities, {len(all_cashflow_items)} cashflow items for owner {owner_id}")

    # Create lookup dictionaries for quick access
    assets_by_id = {asset.id: asset for asset in all_assets}
    liabilities_by_id = {liability.id: liability for liability in all_liabilities}
    
    # Create a mutable copy of cashflow items to work with
    # Initialize a temporary yearly_value for all cashflow items based on their stored value
    # Dynamic items will have their yearly_value updated later
    processed_cashflow_items = []
    for item in all_cashflow_items:
        item_copy = {
            "id": item.id,
            "owner_id": item.owner_id,
            "is_income": item.is_income,
            "description": item.description,
            "yearly_value": item.yearly_value,
            "linked_item_id": item.linked_item_id,
            "linked_item_type": item.linked_item_type,
            "percentage": item.percentage,
            "annual_increase_percent": item.annual_increase_percent,
            "inflation_percent": item.inflation_percent,
            "category": item.category,
            "frequency": item.frequency,
            "person": item.person,
            "start_date": item.start_date,
            "end_date": item.end_date,
            "taxable": item.taxable,
            "tax_deductible": item.tax_deductible,
        }
        if not item_copy.get("linked_item_id") and not item_copy.get("linked_item_type") and item_copy.get("percentage") is None:
            # For static items, yearly_value is already stored
            pass # No change needed, yearly_value is already loaded from DB
        else:
            # Mark dynamic items to be resolved
            item_copy["yearly_value"] = 0.0 # Temporarily set to 0, will be calculated
        processed_cashflow_items.append(item_copy)

    # Convert to dictionary for easy lookup and modification
    cashflow_by_id = {item["id"]: item for item in processed_cashflow_items}

    print(f"DEBUG: Initial processed cashflow items: {processed_cashflow_items}")

    # 2. Iteratively resolve dynamic CashFlowItems
    # This loop will ensure that items dependent on other cashflow items are calculated
    # in the correct order. It will continue until no more items can be resolved in a pass.
    resolved_count = -1 # Initialize to -1 to enter the loop at least once
    max_passes = len(processed_cashflow_items) * 2 # Safety break for circular dependencies

    current_pass = 0
    while resolved_count != 0 and current_pass < max_passes:
        resolved_count = 0
        print(f"DEBUG: Starting pass {current_pass + 1} for dynamic item resolution.")
        for item_dict in processed_cashflow_items:
            if item_dict.get("linked_item_id") and item_dict.get("linked_item_type") and item_dict.get("percentage") is not None:
                print(f"DEBUG: Processing dynamic item: {item_dict['description']} (ID: {item_dict['id']})")
                
                # If yearly_value is already calculated, skip
                if item_dict["yearly_value"] != 0.0:
                    print(f"DEBUG: Item {item_dict['description']} already resolved with yearly_value: {item_dict['yearly_value']}")
                    continue

                linked_value = 0.0
                linked_item_resolved = False

                linked_item_type = item_dict["linked_item_type"]
                linked_item_id = item_dict["linked_item_id"]

                if linked_item_type == 'income' and linked_item_id in cashflow_by_id:
                    # Check if the linked cashflow item's yearly_value is already resolved
                    linked_cf_item = cashflow_by_id.get(linked_item_id)
                    if linked_cf_item and linked_cf_item["yearly_value"] != 0.0:
                        linked_value = linked_cf_item["yearly_value"]
                        linked_item_resolved = True
                elif linked_item_type == 'expense' and linked_item_id in cashflow_by_id:
                    # Check if the linked cashflow item's yearly_value is already resolved
                    linked_cf_item = cashflow_by_id.get(linked_item_id)
                    if linked_cf_item and linked_cf_item["yearly_value"] != 0.0:
                        linked_value = linked_cf_item["yearly_value"]
                        linked_item_resolved = True
                
                print(f"DEBUG: Linked item type: {linked_item_type}, ID: {linked_item_id}, Resolved: {linked_item_resolved}, Linked value: {linked_value}")

                if linked_item_resolved:
                    item_dict["yearly_value"] = linked_value * (item_dict["percentage"] / 100.0)
                    resolved_count += 1
                    print(f"DEBUG: Item {item_dict['description']} (ID: {item_dict['id']}) resolved. New yearly_value: {item_dict['yearly_value']}")
        current_pass += 1
        print(f"DEBUG: Pass {current_pass} completed. Resolved {resolved_count} items. Total passes: {current_pass}/{max_passes}")
        
    print(f"DEBUG: Final processed cashflow items after iterative resolution: {processed_cashflow_items}")

    # After resolution, convert CashFlowItems to an account-like structure for projection
    final_cashflow_accounts = []
    for item_dict in processed_cashflow_items:
        final_cashflow_accounts.append({
            "name": item_dict["description"], # Use description as name for projection clarity
            "type": "income" if item_dict["is_income"] else "expense", # Treat as income/expense for cashflow
            "initial_balance": 0.0, # Cash flow items don't have an initial balance in this context
            "monthly_contribution": item_dict["yearly_value"] / 12, # Always monthly equivalent
            "annual_increase_percent": item_dict["annual_increase_percent"] if item_dict["is_income"] else item_dict["inflation_percent"],
            "annual_change_type": "increase" if item_dict["is_income"] else "decrease", # Income increases, expense decreases
            "id": item_dict["id"], # Keep original ID for potential future lookup
        })
    
    print(f"DEBUG: Final cashflow accounts for projection: {final_cashflow_accounts}")

    # Combine original accounts with processed cash flow items
    # Ensure 'accounts' passed in are already Pydantic models or similar dicts
    # Convert incoming Pydantic AccountSchema objects to dicts for mutable list
    # Start by including all assets and liabilities from the database to ensure their values are tracked
    combined_accounts = []
    for asset in all_assets:
        combined_accounts.append({
            "name": asset.name,
            "initial_balance": asset.value,
            "type": "asset",
            "annual_increase_percent": asset.annual_increase_percent,
            "annual_change_type": asset.annual_change_type,
            "id": asset.id
        })
    for liability in all_liabilities:
        combined_accounts.append({
            "name": liability.name,
            "initial_balance": liability.value,
            "type": "liability",
            "annual_increase_percent": liability.annual_increase_percent,
            "annual_change_type": liability.annual_change_type,
            "id": liability.id
        })

    # Then, add incoming 'accounts' from the frontend, avoiding duplicates with existing assets/liabilities
    existing_names = {acc["name"] for acc in combined_accounts}
    for acc in accounts:
        acc_dict = acc.model_dump() if hasattr(acc, 'model_dump') else acc
        if acc_dict["name"] not in existing_names:
            combined_accounts.append(acc_dict)
            existing_names.add(acc_dict["name"])
    
    # Filter out cashflow_items that are already in `accounts` from `combined_accounts`
    # This scenario would happen if a cashflow item is sent by the frontend as part of `accounts`
    # We prioritize the dynamically calculated value, so we'll ensure no duplicates.
    existing_account_names = {acc["name"] for acc in combined_accounts} # Re-initialize after adding assets/liabilities and initial accounts
    for cf_acc in final_cashflow_accounts: # Now add cashflow items
        if cf_acc["name"] not in existing_account_names:
            combined_accounts.append(cf_acc)
            existing_account_names.add(cf_acc["name"])

    print(f"DEBUG: Combined accounts for main projection loop: {combined_accounts}")

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

        starting_value = previous_year_total_value

        yearly_record = {
            "Year": year,
            "StartingValue": starting_value,
        }
        current_year_total_value = 0.0
        year_total_contributions = 0.0
        year_total_growth = 0.0

        # Create a copy of account_balances to work with for the current year's calculations.
        # This allows us to update asset/liability balances before calculating dynamic cash flow items
        # based on these updated values.
        current_year_balances = account_balances.copy()

        # Phase 1: Project balances for all accounts (assets, liabilities, and static income/expense)
        # This updates current_year_balances with the projected values for the current year.
        for account in combined_accounts:
            current_balance = account_balances.get(account["name"], 0.0)

            rate_from_schema = account.get('annual_increase_percent', 0.0) / 100.0
            change_type = account.get('annual_change_type', 'increase')

            effective_rate = rate_from_schema
            if change_type == "decrease":
                effective_rate = -effective_rate

            # For assets and liabilities, consider their existing monthly_contribution.
            # For income/expense accounts, their monthly_contribution will be fully determined
            # after dynamic calculations in Phase 2/3.
            monthly_contribution = account.get("monthly_contribution", 0.0)
            adjusted_annual_contribution = monthly_contribution * 12

            if account["type"] == "liability" or account["type"] == "expense":
                adjusted_annual_contribution = -abs(adjusted_annual_contribution)
            elif account["type"] == "income":
                adjusted_annual_contribution = abs(adjusted_annual_contribution)

            # Calculate growth based on the previous year's ending balance and current year's contributions
            growth_on_balance = current_balance * effective_rate
            growth_on_contributions = adjusted_annual_contribution * effective_rate * 0.5

            # Update the balance in the temporary current_year_balances for assets and liabilities.
            # This updated value will be used for dynamic cash flow calculations in Phase 2.
            # For cash flow accounts, this balance will be finalized in Phase 3.
            new_balance = current_balance + adjusted_annual_contribution + growth_on_balance + growth_on_contributions
            current_year_balances[account["name"]] = new_balance

        # Phase 2: Dynamically calculate cash flow items linked to assets/liabilities for the current year.
        # This phase now uses the *current_year_balances* calculated in Phase 1.
        for item_dict in processed_cashflow_items:
            if item_dict.get("linked_item_id") and item_dict.get("linked_item_type") and item_dict.get("percentage") is not None:
                linked_item_type = item_dict["linked_item_type"]
                linked_item_id = item_dict["linked_item_id"]

                if linked_item_type in ['asset', 'liability']: # Re-evaluate for each year
                    linked_value = 0.0
                    if linked_item_type == 'asset' and linked_item_id in assets_by_id:
                        asset_name = assets_by_id[linked_item_id].name
                        # Use current_year_balances for the most up-to-date asset value for the current year
                        linked_value = current_year_balances.get(asset_name, assets_by_id[linked_item_id].value)
                    elif linked_item_type == 'liability' and linked_item_id in liabilities_by_id:
                        liability_name = liabilities_by_id[linked_item_id].name
                        # Use current_year_balances for the most up-to-date liability value for the current year
                        linked_value = current_year_balances.get(liability_name, liabilities_by_id[linked_item_id].value)

                    item_dict["yearly_value"] = linked_value * (item_dict["percentage"] / 100.0)

        # Phase 3: Update the monthly_contribution for cashflow accounts in combined_accounts
        #          based on newly calculated yearly_value from Phase 2.
        #          Then, finalize the yearly record and update overall totals.
        for account in combined_accounts:
            current_balance = account_balances.get(account["name"], 0.0) # Start from previous year's end balance

            if account["type"] in ['income', 'expense'] and account.get('id') is not None:
                original_cf_item = cashflow_by_id.get(account["id"])
                if original_cf_item and original_cf_item.get("linked_item_type") in ['asset', 'liability']:
                    account["monthly_contribution"] = original_cf_item["yearly_value"] / 12
        
            # Now that monthly_contribution is finalized for all, recalculate adjusted_annual_contribution
            monthly_contribution = account.get("monthly_contribution", 0.0)
            adjusted_annual_contribution = monthly_contribution * 12

            if account["type"] == "liability" or account["type"] == "expense":
                adjusted_annual_contribution = -abs(adjusted_annual_contribution)
            elif account["type"] == "income":
                adjusted_annual_contribution = abs(adjusted_annual_contribution)

            # Accumulate totals
            total_contribution += adjusted_annual_contribution
            year_total_contributions += adjusted_annual_contribution

            # Recalculate growth with finalized contributions for this account
            rate_from_schema = account.get('annual_increase_percent', 0.0) / 100.0
            change_type = account.get('annual_change_type', 'increase')

            effective_rate = rate_from_schema
            if change_type == "decrease":
                effective_rate = -effective_rate

            growth_on_balance = current_balance * effective_rate
            growth_on_contributions = adjusted_annual_contribution * effective_rate * 0.5
            year_total_growth += growth_on_balance + growth_on_contributions

            # Final new balance for the account for this year
            new_balance = current_balance + adjusted_annual_contribution + growth_on_balance + growth_on_contributions
            if account["type"] in ['asset', 'liability']:
                account_balances[account["name"]] = new_balance # Update for next year's starting balance
                yearly_record[f"{account['name']}_Value"] = new_balance
            else: # For 'income' or 'expense'
                # For income/expense, the 'value' in the chart is the annual flow, not a cumulative balance
                yearly_record[f"{account['name']}_Value"] = adjusted_annual_contribution
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
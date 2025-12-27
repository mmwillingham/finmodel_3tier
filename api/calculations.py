# api/calculations.py

import pandas as pd
import json
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
import models

logger = logging.getLogger(__name__)

def calculate_projection(years: int, accounts: list, db: Session, owner_id: int) -> dict:
    print(f"--- DEBUG: ENTERED CALCULATIONS.PY: calculate_projection function for owner {owner_id} ---") # Prominent print

    # 1. Fetch all relevant items for the owner
    all_assets = db.query(models.Asset).filter(models.Asset.owner_id == owner_id).all()
    all_liabilities = db.query(models.Liability).filter(models.Liability.owner_id == owner_id).all()
    all_cashflow_items = db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id == owner_id).all()

    print(f"DEBUG: Fetched {len(all_assets)} assets, {len(all_liabilities)} liabilities, {len(all_cashflow_items)} cashflow items for owner {owner_id}")
    print(f"DEBUG: All CashFlow Items fetched: {all_cashflow_items}") # Print raw cashflow items

    # Create lookup dictionaries for quick access
    assets_by_id = {asset.id: asset for asset in all_assets}
    liabilities_by_id = {liability.id: liability for liability in all_liabilities}
    
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
            "created_at": str(item.created_at),
        }
        if not item_copy.get("linked_item_id") and not item_copy.get("linked_item_type") and item_copy.get("percentage") is None:
            pass
        else:
            item_copy["yearly_value"] = 0.0
        processed_cashflow_items.append(item_copy)

    cashflow_by_id = {item["id"]: item for item in processed_cashflow_items}

    print("DEBUG: Initial processed cashflow items: " + str(processed_cashflow_items))

    resolved_count = -1
    max_passes = len(processed_cashflow_items) * 2

    current_pass = 0
    while resolved_count != 0 and current_pass < max_passes:
        resolved_count = 0
        print(f"DEBUG: Starting pass {current_pass + 1} for dynamic item resolution.")
        for item_dict in processed_cashflow_items:
            if item_dict.get("linked_item_id") and item_dict.get("linked_item_type") and item_dict.get("percentage") is not None:
                print(f"DEBUG: Processing dynamic item: {item_dict['description']} (ID: {item_dict['id']})")
                
                if item_dict["yearly_value"] != 0.0:
                    print(f"DEBUG: Item {item_dict['description']} already resolved with yearly_value: {item_dict['yearly_value']}")
                    continue

                linked_value = 0.0
                linked_item_resolved = False

                linked_item_type = item_dict["linked_item_type"]
                linked_item_id = item_dict["linked_item_id"]

                if linked_item_type == 'income' and linked_item_id in cashflow_by_id:
                    linked_cf_item = cashflow_by_id.get(linked_item_id)
                    if linked_cf_item and linked_cf_item["yearly_value"] != 0.0:
                        linked_value = linked_cf_item["yearly_value"]
                        linked_item_resolved = True
                elif linked_item_type == 'expense' and linked_item_id in cashflow_by_id:
                    linked_cf_item = cashflow_by_id.get(linked_item_id)
                    if linked_cf_item and linked_cf_item["yearly_value"] != 0.0:
                        linked_value = linked_cf_item["yearly_value"]
                        linked_item_resolved = True
                elif linked_item_type == 'asset' and linked_item_id in assets_by_id:
                    linked_asset = assets_by_id.get(linked_item_id)
                    if linked_asset:
                        linked_value = linked_asset.value
                        linked_item_resolved = True
                elif linked_item_type == 'liability' and linked_item_id in liabilities_by_id:
                    linked_liability = liabilities_by_id.get(linked_item_id)
                    if linked_liability:
                        linked_value = linked_liability.value
                        linked_item_resolved = True
                
                print("DEBUG: Linked item type: " + str(linked_item_type) + ", ID: " + str(linked_item_id) + ", Resolved: " + str(linked_item_resolved) + ", Linked value: " + str(linked_value))

                if linked_item_resolved:
                    item_dict["yearly_value"] = linked_value * (item_dict["percentage"] / 100.0)
                    resolved_count += 1
                    print(f"DEBUG: Item {item_dict['description']} (ID: {item_dict['id']}) resolved. New yearly_value: {item_dict['yearly_value']}")
        current_pass += 1
        print(f"DEBUG: Pass {current_pass} completed. Resolved {resolved_count} items. Total passes: {current_pass}/{max_passes}")
        
    print("DEBUG: Final processed cashflow items after iterative resolution: " + str(processed_cashflow_items))

    final_cashflow_accounts = []
    for item_dict in processed_cashflow_items:
        # Check if the cashflow item's category is empty, and assign a default if it's an expense
        # This will help ensure that expenses without an explicit category are still grouped.
        category = item_dict["category"]
        if not item_dict["is_income"] and not category: # If it's an expense and category is empty
             category = "Uncategorized Expenses" # Assign a default category

        final_cashflow_accounts.append({
            "name": item_dict["description"],
            "type": "income" if item_dict["is_income"] else "expense",
            "initial_balance": 0.0,
            "monthly_contribution": item_dict["yearly_value"] / 12,
            "annual_increase_percent": item_dict["annual_increase_percent"] if item_dict["is_income"] else item_dict["inflation_percent"],
            "annual_change_type": "increase" if item_dict["is_income"] else "decrease",
            "id": item_dict["id"],
            "category": category, # Include the category
        })
    
    print("DEBUG: Final cashflow accounts for projection: " + str(final_cashflow_accounts))

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
        # For liabilities, store the negative of their value if it's positive,
        # as liabilities typically reduce net worth.
        initial_liability_balance = -abs(liability.value) if liability.value > 0 else liability.value
        combined_accounts.append({
            "name": liability.name,
            "initial_balance": initial_liability_balance,
            "type": "liability",
            "annual_increase_percent": liability.annual_increase_percent,
            "annual_change_type": liability.annual_change_type,
            "id": liability.id
        })

    existing_names = {acc["name"] for acc in combined_accounts}
    for acc in accounts:
        acc_dict = acc.model_dump() if hasattr(acc, 'model_dump') else acc
        if acc_dict["name"] not in existing_names:
            combined_accounts.append(acc_dict)
            existing_names.add(acc_dict["name"])
    
    existing_account_names = {acc["name"] for acc in combined_accounts}
    for cf_acc in final_cashflow_accounts:
        # If a cash flow account has the same name as an existing asset/liability,
        # we need to make sure they are distinct. Append a suffix like "_CashFlow"
        # to prevent collision and ensure both are tracked.
        if cf_acc["name"] not in existing_account_names:
            combined_accounts.append(cf_acc)
            existing_account_names.add(cf_acc["name"])
        else:
            # If there's a name collision, rename the cash flow account
            cf_acc["name"] = f"{cf_acc['name']}_CashFlow"
            combined_accounts.append(cf_acc)
            existing_account_names.add(cf_acc["name"])

    print("--- DEBUG: Combined accounts for main projection loop: ---") # Prominent print
    for acc in combined_accounts:
        print(f"  Account: {acc['name']}, Type: {acc['type']}, Initial Balance: {acc['initial_balance']}, Annual Increase: {acc.get('annual_increase_percent')}, Change Type: {acc.get('annual_change_type')}, Monthly Contribution: {acc.get('monthly_contribution')}, Category: {acc.get('category')}") # Added Category print

    account_balances = {
        acc["name"]: acc["initial_balance"] for acc in combined_accounts
    }
    
    yearly_results = []
    total_contribution = 0.0
    total_growth = 0.0
    
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

        current_year_balances = account_balances.copy()

        for account in combined_accounts:
            current_balance = account_balances.get(account["name"], 0.0)

            rate_from_schema = account.get('annual_increase_percent', 0.0) / 100.0
            change_type = account.get('annual_change_type', 'increase')

            effective_rate = rate_from_schema
            if change_type == "decrease":
                effective_rate = -effective_rate
            
            print(f"DEBUG: Account: {account['name']}, Type: {account['type']}, effective_rate: {effective_rate}") # New print for effective_rate

            monthly_contribution = account.get("monthly_contribution", 0.0)
            adjusted_annual_contribution = monthly_contribution * 12

            # For liabilities and expenses, contributions are typically negative cash flows
            if account["type"] == "liability" or account["type"] == "expense":
                adjusted_annual_contribution = -abs(adjusted_annual_contribution) if adjusted_annual_contribution > 0 else adjusted_annual_contribution
            elif account["type"] == "income":
                adjusted_annual_contribution = abs(adjusted_annual_contribution)

            growth_on_balance = current_balance * effective_rate
            growth_on_contributions = adjusted_annual_contribution * effective_rate * 0.5

            new_balance = current_balance + adjusted_annual_contribution + growth_on_balance + growth_on_contributions
            current_year_balances[account["name"]] = new_balance

            # ADDED DEBUGGING FOR LIABILITY AND EXPENSE CALCULATIONS
            if account["type"] in ["liability", "expense"]:
                print(f"--- DEBUG (calculations.py) -- Year {year} - Account: {account['name']} (Type: {account['type']}) ---") # Prominent print
                print(f"  current_balance: {current_balance}, monthly_contribution: {monthly_contribution}, adjusted_annual_contribution: {adjusted_annual_contribution}")
                print(f"  rate_from_schema: {rate_from_schema}, change_type: {change_type}, effective_rate: {effective_rate}")
                print(f"  growth_on_balance: {growth_on_balance}, growth_on_contributions: {growth_on_contributions}")
                print(f"  new_balance: {new_balance}")


        # Phase 2: Dynamically calculate cash flow items linked to assets/liabilities for the current year.
        for item_dict in processed_cashflow_items:
            if item_dict.get("linked_item_id") and item_dict.get("linked_item_type") and item_dict.get("percentage") is not None:
                linked_item_type = item_dict["linked_item_type"]
                linked_item_id = item_dict["linked_item_id"]

                if linked_item_type in ['asset', 'liability']:
                    linked_value = 0.0
                    if linked_item_type == 'asset' and linked_item_id in assets_by_id:
                        asset_name = assets_by_id[linked_item_id].name
                        linked_value = current_year_balances.get(asset_name, assets_by_id[linked_item_id].value)
                    elif linked_item_type == 'liability' and linked_item_id in liabilities_by_id:
                        liability_name = liabilities_by_id[linked_item_id].name
                        linked_value = current_year_balances.get(liability_name, liabilities_by_id[linked_item_id].value)

                    item_dict["yearly_value"] = linked_value * (item_dict["percentage"] / 100.0)

        # Phase 3: Update the monthly_contribution for cashflow accounts in combined_accounts
        for account in combined_accounts:
            current_balance = account_balances.get(account["name"], 0.0) # Start from previous year's end balance

            if account["type"] in ['income', 'expense'] and account.get('id') is not None:
                original_cf_item = cashflow_by_id.get(account["id"])
                if original_cf_item and original_cf_item.get("linked_item_type") in ['asset', 'liability']:
                    account["monthly_contribution"] = original_cf_item["yearly_value"] / 12
        
            monthly_contribution = account.get("monthly_contribution", 0.0)
            adjusted_annual_contribution = monthly_contribution * 12

            if account["type"] == "liability" or account["type"] == "expense":
                adjusted_annual_contribution = -abs(adjusted_annual_contribution) if adjusted_annual_contribution > 0 else adjusted_annual_contribution
            elif account["type"] == "income":
                adjusted_annual_contribution = abs(adjusted_annual_contribution)

            total_contribution += adjusted_annual_contribution
            year_total_contributions += adjusted_annual_contribution

            rate_from_schema = account.get('annual_increase_percent', 0.0) / 100.0
            change_type = account.get('annual_change_type', 'increase')

            effective_rate = rate_from_schema
            if change_type == "decrease":
                effective_rate = -effective_rate

            growth_on_balance = current_balance * effective_rate
            growth_on_contributions = adjusted_annual_contribution * effective_rate * 0.5
            year_total_growth += growth_on_balance + growth_on_contributions

            new_balance = current_balance + adjusted_annual_contribution + growth_on_balance + growth_on_contributions
            if account["type"] in ['asset', 'liability']:
                account_balances[account["name"]] = new_balance # Update for next year's starting balance
                yearly_record[f"{account['name']}_Value"] = new_balance
            else: # For 'income' or 'expense'
                # For income/expense, the 'value' in the chart is the annual flow, not a cumulative balance.
                # Ensure expenses are consistently negative for reporting.
                yearly_record[f"{account['name']}_Value"] = adjusted_annual_contribution if account["type"] == "income" else -abs(adjusted_annual_contribution)
            current_year_total_value += new_balance

        # Add totals to yearly record
        yearly_record["Total_Contribution"] = year_total_contributions
        yearly_record["Total_Growth"] = year_total_growth
        yearly_record["Total_Value"] = current_year_total_value

        yearly_results.append(yearly_record)
        previous_year_total_value = current_year_total_value
    # ----------------------------------------------------------------------

    print("--- DEBUG (calculations.py): Raw yearly_results before JSON dump: ---") # Prominent print
    print(json.dumps(yearly_results, indent=2)) # Pretty print for readability

    # 5. The final output structure (returned to the FastAPI endpoint)
    return {
        "final_value": yearly_results[-1]["Total_Value"] if yearly_results else 0.0,
        "total_contributed": total_contribution,
        "total_growth": total_growth,
        # Convert the list of dictionaries to a JSON string for data_json
        "data_json": json.dumps(yearly_results)
    }
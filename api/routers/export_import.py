from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
import auth
import database
import json
import logging
import csv
import io
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/export-import",
    tags=["export-import"],
    responses={404: {"description": "Not found"}},
)

@router.get("/export")
def export_user_data(
    include_accounts: bool = True,
    include_assets: bool = True,
    include_liabilities: bool = True,
    include_income: bool = True,
    include_expenses: bool = True,
    include_projections: bool = True,
    include_charts: bool = True,
    format: str = "json",  # "json" or "csv"
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Export user data as JSON or CSV. Can selectively include/exclude data types.
    """
    try:
        export_data = {
            "export_date": datetime.now().isoformat(),
            "user_id": current_user.id,
            "user_email": current_user.email,
            "data": {}
        }

        if include_accounts:
            accounts = db.query(models.Account).filter(models.Account.owner_id == current_user.id).all()
            export_data["data"]["accounts"] = [
                {
                    "brokerage": acc.brokerage,
                    "broker_name": acc.broker_name,
                    "broker_phone": acc.broker_phone,
                    "broker_email": acc.broker_email,
                    "account_name": acc.account_name,
                    "account_number": acc.account_number,
                    "is_retirement": acc.is_retirement,
                }
                for acc in accounts
            ]

        if include_assets:
            assets = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id).all()
            export_data["data"]["assets"] = [
                {
                    "name": ast.name,
                    "category": ast.category,
                    "value": ast.value,
                    "account_id": ast.account_id,
                    "annual_change_type": ast.annual_change_type,
                    "annual_increase_percent": ast.annual_increase_percent,
                    "start_date": ast.start_date,
                    "end_date": ast.end_date,
                }
                for ast in assets
            ]

        if include_liabilities:
            liabilities = db.query(models.Liability).filter(models.Liability.owner_id == current_user.id).all()
            export_data["data"]["liabilities"] = [
                {
                    "name": lib.name,
                    "category": lib.category,
                    "value": lib.value,
                    "loan_type": lib.loan_type,
                    "principal_amount": lib.principal_amount,
                    "interest_rate": lib.interest_rate,
                    "loan_term_months": lib.loan_term_months,
                    "monthly_payment": lib.monthly_payment,
                    "annual_increase_percent": lib.annual_increase_percent,
                    "expense_category": lib.expense_category,
                }
                for lib in liabilities
            ]

        if include_income:
            income_items = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.owner_id == current_user.id,
                models.CashFlowItem.is_income == True
            ).all()
            export_data["data"]["income"] = [
                {
                    "category": item.category,
                    "description": item.description,
                    "person": item.person,
                    "frequency": item.frequency,
                    "yearly_value": item.yearly_value,
                    "start_date": item.start_date,
                    "end_date": item.end_date,
                    "linked_item_type": item.linked_item_type,
                    "linked_item_id": item.linked_item_id,
                    "linked_asset_ids": item.linked_asset_ids if item.linked_asset_ids is not None else None,
                    "percentage": item.percentage,
                    "annual_increase_percent": item.annual_increase_percent,
                    "taxable": item.taxable,
                }
                for item in income_items
            ]

        if include_expenses:
            expense_items = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.owner_id == current_user.id,
                models.CashFlowItem.is_income == False
            ).all()
            export_data["data"]["expenses"] = [
                {
                    "category": item.category,
                    "description": item.description,
                    "person": item.person,
                    "frequency": item.frequency,
                    "yearly_value": item.yearly_value,
                    "start_date": item.start_date,
                    "end_date": item.end_date,
                    "linked_item_type": item.linked_item_type,
                    "linked_item_id": item.linked_item_id,
                    "linked_asset_ids": item.linked_asset_ids if item.linked_asset_ids is not None else None,
                    "percentage": item.percentage,
                    "inflation_percent": item.inflation_percent,
                    "tax_deductible": item.tax_deductible,
                    "contributes_to_asset_id": item.contributes_to_asset_id,
                }
                for item in expense_items
            ]

        if include_projections:
            projections = db.query(models.Projection).filter(models.Projection.owner_id == current_user.id).all()
            export_data["data"]["projections"] = [
                {
                    "name": proj.name,
                    "years": proj.years,
                    "final_value": proj.final_value,
                    "total_contributed": proj.total_contributed,
                    "total_growth": proj.total_growth,
                    "timestamp": proj.timestamp.isoformat() if proj.timestamp else None,
                }
                for proj in projections
            ]

        if include_charts:
            charts = db.query(models.CustomChart).filter(models.CustomChart.user_id == current_user.id).all()
            export_data["data"]["charts"] = [
                {
                    "name": chart.name,
                    "chart_type": chart.chart_type,
                    "series_configurations": json.loads(chart.series_configurations) if isinstance(chart.series_configurations, str) else chart.series_configurations,
                    "display_type": chart.display_type,
                    "years": chart.years,
                    "show_chart_totals": chart.show_chart_totals,
                }
                for chart in charts
            ]

        # Return CSV format if requested
        if format.lower() == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write metadata
            writer.writerow(["Field", "Value"])
            writer.writerow(["Export Date", export_data["export_date"]])
            writer.writerow(["User Email", export_data["user_email"]])
            writer.writerow([])
            
            # Write each data section
            if export_data["data"].get("accounts"):
                writer.writerow(["ACCOUNTS"])
                accounts = export_data["data"]["accounts"]
                if accounts:
                    headers = list(accounts[0].keys())
                    writer.writerow(headers)
                    for acc in accounts:
                        writer.writerow([acc.get(h, "") for h in headers])
                writer.writerow([])
            
            if export_data["data"].get("assets"):
                writer.writerow(["ASSETS"])
                assets = export_data["data"]["assets"]
                if assets:
                    headers = list(assets[0].keys())
                    writer.writerow(headers)
                    for ast in assets:
                        writer.writerow([ast.get(h, "") for h in headers])
                writer.writerow([])
            
            if export_data["data"].get("liabilities"):
                writer.writerow(["LIABILITIES"])
                liabilities = export_data["data"]["liabilities"]
                if liabilities:
                    headers = list(liabilities[0].keys())
                    writer.writerow(headers)
                    for lib in liabilities:
                        writer.writerow([lib.get(h, "") for h in headers])
                writer.writerow([])
            
            if export_data["data"].get("income"):
                writer.writerow(["INCOME"])
                income = export_data["data"]["income"]
                if income:
                    headers = list(income[0].keys())
                    writer.writerow(headers)
                    for inc in income:
                        writer.writerow([inc.get(h, "") for h in headers])
                writer.writerow([])
            
            if export_data["data"].get("expenses"):
                writer.writerow(["EXPENSES"])
                expenses = export_data["data"]["expenses"]
                if expenses:
                    headers = list(expenses[0].keys())
                    writer.writerow(headers)
                    for exp in expenses:
                        writer.writerow([exp.get(h, "") for h in headers])
                writer.writerow([])
            
            if export_data["data"].get("projections"):
                writer.writerow(["PROJECTIONS"])
                projections = export_data["data"]["projections"]
                if projections:
                    headers = list(projections[0].keys())
                    writer.writerow(headers)
                    for proj in projections:
                        writer.writerow([proj.get(h, "") for h in headers])
                writer.writerow([])
            
            if export_data["data"].get("charts"):
                writer.writerow(["CHARTS"])
                charts = export_data["data"]["charts"]
                if charts:
                    # Flatten series_configurations for CSV
                    headers = ["name", "chart_type", "display_type", "years", "show_chart_totals", "series_configurations"]
                    writer.writerow(headers)
                    for chart in charts:
                        series_config_str = json.dumps(chart.get("series_configurations", [])) if chart.get("series_configurations") else ""
                        writer.writerow([
                            chart.get("name", ""),
                            chart.get("chart_type", ""),
                            chart.get("display_type", ""),
                            chart.get("years", ""),
                            chart.get("show_chart_totals", ""),
                            series_config_str
                        ])
            
            csv_content = output.getvalue()
            output.close()
            
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f'attachment; filename="financial_data_export_{datetime.now().strftime("%Y%m%d")}.csv"'
                }
            )
        
        # Return JSON format (default)
        return export_data

    except Exception as e:
        logger.error(f"Error exporting user data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export data: {str(e)}"
        )

@router.post("/import")
def import_user_data(
    import_data: dict,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Import user data from JSON. Can selectively import data types.
    """
    try:
        imported_counts = {
            "accounts": 0,
            "assets": 0,
            "liabilities": 0,
            "income": 0,
            "expenses": 0,
            "projections": 0,
            "charts": 0,
            "errors": []
        }

        data = import_data.get("data", {})
        
        # Get existing account IDs to map during import
        existing_accounts = {acc.account_name: acc.id for acc in db.query(models.Account).filter(models.Account.owner_id == current_user.id).all()}

        # Import accounts
        if "accounts" in data:
            for acc_data in data["accounts"]:
                try:
                    # Check if account already exists (by account_name)
                    existing = db.query(models.Account).filter(
                        models.Account.owner_id == current_user.id,
                        models.Account.account_name == acc_data.get("account_name")
                    ).first()
                    
                    if not existing:
                        new_account = models.Account(
                            owner_id=current_user.id,
                            brokerage=acc_data.get("brokerage", ""),
                            broker_name=acc_data.get("broker_name"),
                            broker_phone=acc_data.get("broker_phone"),
                            broker_email=acc_data.get("broker_email"),
                            account_name=acc_data.get("account_name", ""),
                            account_number=acc_data.get("account_number"),
                            is_retirement=acc_data.get("is_retirement", False),
                        )
                        db.add(new_account)
                        db.flush()
                        existing_accounts[acc_data.get("account_name")] = new_account.id
                        imported_counts["accounts"] += 1
                except Exception as e:
                    imported_counts["errors"].append(f"Account {acc_data.get('account_name', 'unknown')}: {str(e)}")

        # Import assets
        if "assets" in data:
            for ast_data in data["assets"]:
                try:
                    account_id = None
                    if ast_data.get("account_id"):
                        # Try to find account by name if account_id doesn't match
                        account_name = ast_data.get("account_name")
                        if account_name and account_name in existing_accounts:
                            account_id = existing_accounts[account_name]
                    
                    new_asset = models.Asset(
                        owner_id=current_user.id,
                        name=ast_data.get("name", ""),
                        category=ast_data.get("category", ""),
                        value=ast_data.get("value", 0),
                        account_id=account_id,
                        annual_change_type=ast_data.get("annual_change_type"),
                        annual_increase_percent=ast_data.get("annual_increase_percent"),
                        start_date=ast_data.get("start_date"),
                        end_date=ast_data.get("end_date"),
                    )
                    db.add(new_asset)
                    imported_counts["assets"] += 1
                except Exception as e:
                    imported_counts["errors"].append(f"Asset {ast_data.get('name', 'unknown')}: {str(e)}")

        # Import liabilities
        if "liabilities" in data:
            for lib_data in data["liabilities"]:
                try:
                    new_liability = models.Liability(
                        owner_id=current_user.id,
                        name=lib_data.get("name", ""),
                        category=lib_data.get("category", ""),
                        value=lib_data.get("value", 0),
                        loan_type=lib_data.get("loan_type"),
                        principal_amount=lib_data.get("principal_amount"),
                        interest_rate=lib_data.get("interest_rate"),
                        loan_term_months=lib_data.get("loan_term_months"),
                        monthly_payment=lib_data.get("monthly_payment"),
                        annual_increase_percent=lib_data.get("annual_increase_percent"),
                        expense_category=lib_data.get("expense_category"),
                    )
                    db.add(new_liability)
                    imported_counts["liabilities"] += 1
                except Exception as e:
                    imported_counts["errors"].append(f"Liability {lib_data.get('name', 'unknown')}: {str(e)}")

        # Import income
        if "income" in data:
            for inc_data in data["income"]:
                try:
                    new_income = models.CashFlowItem(
                        owner_id=current_user.id,
                        type="income",
                        category=inc_data.get("category", ""),
                        description=inc_data.get("description", ""),
                        person=inc_data.get("person"),
                        frequency=inc_data.get("frequency", "yearly"),
                        yearly_value=inc_data.get("yearly_value", 0),
                        start_date=inc_data.get("start_date"),
                        end_date=inc_data.get("end_date"),
                        linked_item_type=inc_data.get("linked_item_type"),
                        linked_item_id=inc_data.get("linked_item_id"),
                        linked_asset_ids=inc_data.get("linked_asset_ids"),
                        annual_increase_percent=inc_data.get("annual_increase_percent"),
                        taxable=inc_data.get("taxable", False),
                    )
                    db.add(new_income)
                    imported_counts["income"] += 1
                except Exception as e:
                    imported_counts["errors"].append(f"Income {inc_data.get('description', 'unknown')}: {str(e)}")

        # Import expenses
        if "expenses" in data:
            for exp_data in data["expenses"]:
                try:
                    new_expense = models.CashFlowItem(
                        owner_id=current_user.id,
                        type="expense",
                        category=exp_data.get("category", ""),
                        description=exp_data.get("description", ""),
                        person=exp_data.get("person"),
                        frequency=exp_data.get("frequency", "yearly"),
                        yearly_value=exp_data.get("yearly_value", 0),
                        start_date=exp_data.get("start_date"),
                        end_date=exp_data.get("end_date"),
                        linked_item_type=exp_data.get("linked_item_type"),
                        linked_item_id=exp_data.get("linked_item_id"),
                        linked_asset_ids=exp_data.get("linked_asset_ids"),
                        inflation_percent=exp_data.get("inflation_percent"),
                        tax_deductible=exp_data.get("tax_deductible", False),
                        contributes_to_asset_id=exp_data.get("contributes_to_asset_id"),
                    )
                    db.add(new_expense)
                    imported_counts["expenses"] += 1
                except Exception as e:
                    imported_counts["errors"].append(f"Expense {exp_data.get('description', 'unknown')}: {str(e)}")

        # Import projections (note: projections are complex, so we just import metadata)
        if "projections" in data:
            for proj_data in data["projections"]:
                try:
                    # Only import if name doesn't already exist
                    existing = db.query(models.Projection).filter(
                        models.Projection.owner_id == current_user.id,
                        models.Projection.name == proj_data.get("name")
                    ).first()
                    if not existing:
                        new_projection = models.Projection(
                            owner_id=current_user.id,
                            name=proj_data.get("name", ""),
                            years=proj_data.get("years", 30),
                        )
                        db.add(new_projection)
                        imported_counts["projections"] += 1
                except Exception as e:
                    imported_counts["errors"].append(f"Projection {proj_data.get('name', 'unknown')}: {str(e)}")

        # Import charts
        if "charts" in data:
            for chart_data in data["charts"]:
                try:
                    # Only import if name doesn't already exist
                    existing = db.query(models.CustomChart).filter(
                        models.CustomChart.user_id == current_user.id,
                        models.CustomChart.name == chart_data.get("name")
                    ).first()
                    if not existing:
                        new_chart = models.CustomChart(
                            user_id=current_user.id,
                            name=chart_data.get("name", ""),
                            chart_type=chart_data.get("chart_type", "line"),
                            series_configurations=json.dumps(chart_data.get("series_configurations", [])) if isinstance(chart_data.get("series_configurations"), list) else chart_data.get("series_configurations", "[]"),
                            display_type=chart_data.get("display_type", "chart"),
                            years=chart_data.get("years", 30),
                            show_chart_totals=chart_data.get("show_chart_totals", False),
                        )
                        db.add(new_chart)
                        imported_counts["charts"] += 1
                except Exception as e:
                    imported_counts["errors"].append(f"Chart {chart_data.get('name', 'unknown')}: {str(e)}")

        db.commit()
        return imported_counts

    except Exception as e:
        db.rollback()
        logger.error(f"Error importing user data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import data: {str(e)}"
        )


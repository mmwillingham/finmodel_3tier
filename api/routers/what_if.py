from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import models
import schemas
import auth
import database
from config import settings
import logging
from openai import OpenAI
import json

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/what-if",
    tags=["what-if"],
    responses={404: {"description": "Not found"}},
)

class WhatIfRequest(BaseModel):
    question: str

class WhatIfResponse(BaseModel):
    answer: str

def get_financial_summary(db: Session, user_id: int) -> dict:
    """Get a summary of the user's financial data for AI context."""
    # Get assets
    assets = db.query(models.Asset).filter(models.Asset.owner_id == user_id).all()
    assets_summary = []
    total_assets = 0
    for asset in assets:
        assets_summary.append({
            "name": asset.name,
            "category": asset.category,
            "value": float(asset.value) if asset.value else 0,
            "annual_increase_percent": float(asset.annual_increase_percent) if asset.annual_increase_percent else 0,
            "retirement_interest_rate": float(asset.retirement_interest_rate) if asset.retirement_interest_rate else None,
            "retirement_dividend_rate": float(asset.retirement_dividend_rate) if asset.retirement_dividend_rate else None,
        })
        total_assets += float(asset.value) if asset.value else 0
    
    # Get liabilities
    liabilities = db.query(models.Liability).filter(models.Liability.owner_id == user_id).all()
    liabilities_summary = []
    total_liabilities = 0
    for liability in liabilities:
        liabilities_summary.append({
            "name": liability.name,
            "category": liability.category,
            "value": float(liability.value) if liability.value else 0,
            "interest_rate": float(liability.interest_rate) if liability.interest_rate else None,
            "monthly_payment": float(liability.monthly_payment) if liability.monthly_payment else None,
            "annual_increase_percent": float(liability.annual_increase_percent) if liability.annual_increase_percent else 0,
        })
        total_liabilities += float(liability.value) if liability.value else 0
    
    # Get income items
    income_items = db.query(models.CashFlowItem).filter(
        models.CashFlowItem.owner_id == user_id,
        models.CashFlowItem.is_income == True
    ).all()
    income_summary = []
    total_annual_income = 0
    for item in income_items:
        yearly_value = float(item.yearly_value) if item.yearly_value else 0
        income_summary.append({
            "name": item.description,
            "category": item.category,
            "yearly_value": yearly_value,
            "annual_increase_percent": float(item.annual_increase_percent) if item.annual_increase_percent else 0,
            "start_date": item.start_date,
            "end_date": item.end_date,
        })
        total_annual_income += yearly_value
    
    # Get expense items
    expense_items = db.query(models.CashFlowItem).filter(
        models.CashFlowItem.owner_id == user_id,
        models.CashFlowItem.is_income == False
    ).all()
    expense_summary = []
    total_annual_expenses = 0
    for item in expense_items:
        yearly_value = float(item.yearly_value) if item.yearly_value else 0
        expense_summary.append({
            "name": item.description,
            "category": item.category,
            "yearly_value": yearly_value,
            "inflation_percent": float(item.inflation_percent) if item.inflation_percent else 0,
            "start_date": item.start_date,
            "end_date": item.end_date,
        })
        total_annual_expenses += yearly_value
    
    # Get user settings
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == user_id).first()
    projection_years = user_settings.projection_years if user_settings else 30
    
    return {
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "net_worth": total_assets - total_liabilities,
        "total_annual_income": total_annual_income,
        "total_annual_expenses": total_annual_expenses,
        "annual_surplus": total_annual_income - total_annual_expenses,
        "projection_years": projection_years,
        "assets": assets_summary,
        "liabilities": liabilities_summary,
        "income_items": income_summary,
        "expense_items": expense_summary,
    }

@router.post("/ask", response_model=WhatIfResponse)
async def ask_what_if(
    request: WhatIfRequest,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Ask a "What If?" question about financial scenarios.
    The AI will analyze the user's financial data and provide insights.
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured. Please contact support."
        )
    
    try:
        # Get financial summary for the current user (or viewing user if authorized)
        user_id = current_user.id
        financial_data = get_financial_summary(db, user_id)
        
        # Create the prompt for OpenAI
        system_prompt = """You are a financial planning assistant helping users explore "What If?" scenarios with their financial data. 
You have access to their current financial situation including assets, liabilities, income, and expenses.
Provide thoughtful, helpful analysis based on their question and financial data. Be specific with numbers when possible.
If the question requires calculations or projections, explain your reasoning clearly."""
        
        user_prompt = f"""User's Financial Summary:
- Total Assets: ${financial_data['total_assets']:,.2f}
- Total Liabilities: ${financial_data['total_liabilities']:,.2f}
- Net Worth: ${financial_data['net_worth']:,.2f}
- Total Annual Income: ${financial_data['total_annual_income']:,.2f}
- Total Annual Expenses: ${financial_data['total_annual_expenses']:,.2f}
- Annual Surplus: ${financial_data['annual_surplus']:,.2f}
- Projection Years: {financial_data['projection_years']}

Assets ({len(financial_data['assets'])} items):
{json.dumps(financial_data['assets'], indent=2)}

Liabilities ({len(financial_data['liabilities'])} items):
{json.dumps(financial_data['liabilities'], indent=2)}

Income Items ({len(financial_data['income_items'])} items):
{json.dumps(financial_data['income_items'], indent=2)}

Expense Items ({len(financial_data['expense_items'])} items):
{json.dumps(financial_data['expense_items'], indent=2)}

User's Question: {request.question}

Please provide a detailed answer to their "What If?" question, using their actual financial data to inform your response."""
        
        # Call OpenAI API
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using gpt-4o-mini for cost efficiency, can be upgraded to gpt-4 if needed
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            stream=True,
            max_tokens=4000  # Increased from 1000 to allow for complete, detailed responses
        )
        
        answer = response.choices[0].message.content
        
        logger.info(f"What If question answered for user {user_id}: {request.question[:50]}...")
        
        return WhatIfResponse(answer=answer)
        
    except Exception as e:
        logger.error(f"Error processing What If question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process question: {str(e)}"
        )

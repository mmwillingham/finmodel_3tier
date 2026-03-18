from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import models
import schemas
import auth
import database
from config import settings
import logging
from openai import OpenAI
import json
from utils.subscription import get_user_limits


DEFAULT_PROJECTION_YEARS = schemas.UserSettingsBase.model_fields['projection_years'].default

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
    projection_years = user_settings.projection_years if user_settings else DEFAULT_PROJECTION_YEARS
    
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

async def generate_streaming_response(request: WhatIfRequest, db: Session, current_user: schemas.UserOut):
    """Generator function that yields chunks from OpenAI stream as Server-Sent Events."""
    if not settings.OPENAI_API_KEY:
        yield f"data: {json.dumps({'error': 'OpenAI API key not configured. Please contact support.'})}\n\n"
        return
    
    # Select model name (Router already verified level is 2 or 3)
    model_name = settings.OPENAI_MODEL_PRO if current_user.subscription_level == 3 else settings.OPENAI_MODEL_DEFAULT

    try:
        user_id = current_user.id
        financial_data = get_financial_summary(db, user_id)
        
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
        
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        stream = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            stream=True,
            max_tokens=4000
        )
        
        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    yield f"data: {json.dumps({'chunk': delta.content})}\n\n"
        
        yield f"data: {json.dumps({'done': True})}\n\n"
        
    except Exception as e:
        logger.error(f"Error processing What If question: {e}", exc_info=True)
        yield f"data: {json.dumps({'error': f'Failed to process question: {str(e)}'})}\n\n"


@router.post("/ask")
async def ask_what_if(
    request: WhatIfRequest,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    # 1. SUBSCRIPTION LEVEL CHECK (Block Level 1)
    if current_user.subscription_level < 2:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Upgrade to Pro or Premium to enable What If scenarios. See Pricing page for details."
        )

    # 2. MONTHLY LIMIT CHECK
    limits = get_user_limits(db, current_user)
    if limits["is_limited"] and limits["max_whatif_monthly"] is not None:
        start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        usage_count = db.query(models.WhatIfRequestLog).filter(
            models.WhatIfRequestLog.user_id == current_user.id,
            models.WhatIfRequestLog.created_at >= start_of_month
        ).count()
        if usage_count >= limits["max_whatif_monthly"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Free plan supports up to {limits['max_whatif_monthly']} What If requests per month.  Please upgrade to ask unlimited questions. See Pricing page for details."
            )

    # 3. LOG REQUEST AND RUN
    db.add(models.WhatIfRequestLog(user_id=current_user.id))
    db.commit()

    return StreamingResponse(
        generate_streaming_response(request, db, current_user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

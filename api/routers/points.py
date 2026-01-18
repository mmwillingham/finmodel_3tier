from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from pydantic import ConfigDict
import models
import schemas
import auth
import database
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/points",
    tags=["points"],
    responses={404: {"description": "Not found"}},
)

class PointsBreakdown(BaseModel):
    accounts: int = 0
    assets: int = 0
    liabilities: int = 0
    cashflow_items: int = 0
    referrals_sent: int = 0
    referrals_registered: int = 0
    folders: int = 0
    documents: int = 0
    surplus_asset: int = 0  # 1 if surplus asset is set, 0 otherwise
    auto_disbursements: int = 0  # Count of auto-disbursements
    plaid_connections: int = 0  # Count of connected bank accounts (Plaid items)

class PointsResponse(BaseModel):
    total_points: int
    breakdown: PointsBreakdown
    model_config = ConfigDict(from_attributes=True)

@router.get("/", response_model=PointsResponse)
def get_user_points(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Calculate and return the total points for the current user.
    Points are calculated based on:
    - Number of accounts
    - Number of assets
    - Number of liabilities
    - Number of cash flow items (income + expenses)
    - Number of referrals sent
    - Number of referrals that registered
    - Surplus asset configured (1 point if set)
    - Number of auto-disbursements configured
    - Number of connected bank accounts (Plaid items) - 25 points each
    """
    try:
        # Get user ID from the current_user schema
        user_id = current_user.id

        # Count accounts
        accounts_count = db.query(func.count(models.Account.id)).filter(
            models.Account.owner_id == user_id
        ).scalar() or 0

        # Count assets
        assets_count = db.query(func.count(models.Asset.id)).filter(
            models.Asset.owner_id == user_id
        ).scalar() or 0

        # Count liabilities
        liabilities_count = db.query(func.count(models.Liability.id)).filter(
            models.Liability.owner_id == user_id
        ).scalar() or 0

        # Count cash flow items (income + expenses)
        cashflow_count = db.query(func.count(models.CashFlowItem.id)).filter(
            models.CashFlowItem.owner_id == user_id
        ).scalar() or 0

        # Count referrals sent
        referrals_sent_count = db.query(func.count(models.Referral.id)).filter(
            models.Referral.referrer_id == user_id
        ).scalar() or 0

        # Count referrals that registered (friends who actually registered)
        referrals_registered_count = db.query(func.count(models.Referral.id)).filter(
            models.Referral.referrer_id == user_id,
            models.Referral.registered_user_id.isnot(None)
        ).scalar() or 0

        # Count document folders
        folders_count = db.query(func.count(models.DocumentFolder.id)).filter(
            models.DocumentFolder.owner_id == user_id
        ).scalar() or 0

        # Count documents
        documents_count = db.query(func.count(models.Document.id)).filter(
            models.Document.owner_id == user_id
        ).scalar() or 0

        # Check if surplus asset is set
        user_settings = db.query(models.UserSettings).filter(
            models.UserSettings.owner_id == user_id
        ).first()
        surplus_asset_set = 1 if user_settings and user_settings.surplus_asset_id is not None else 0

        # Count auto-disbursements
        auto_disbursements_count = db.query(func.count(models.AutoDisbursement.id)).filter(
            models.AutoDisbursement.owner_id == user_id
        ).scalar() or 0

        # Count Plaid connections (connected bank accounts)
        plaid_connections_count = db.query(func.count(models.PlaidItem.id)).filter(
            models.PlaidItem.owner_id == user_id
        ).scalar() or 0

        # Calculate total points (you can adjust the weighting here)
        total_points = (
            accounts_count * 10 +
            assets_count * 15 +
            liabilities_count * 10 +
            cashflow_count * 5 +
            referrals_sent_count * 25 +
            referrals_registered_count * 100 +  # Bonus points for successful referrals
            folders_count * 5 +  # Points for folders
            documents_count * 10 +  # Points for documents
            surplus_asset_set * 50 +  # Points for setting surplus asset
            auto_disbursements_count * 30 +  # Points per auto-disbursement
            plaid_connections_count * 25  # Points per connected bank account
        )

        breakdown = PointsBreakdown(
            accounts=accounts_count,
            assets=assets_count,
            liabilities=liabilities_count,
            cashflow_items=cashflow_count,
            referrals_sent=referrals_sent_count,
            referrals_registered=referrals_registered_count,
            folders=folders_count,
            documents=documents_count,
            surplus_asset=surplus_asset_set,
            auto_disbursements=auto_disbursements_count,
            plaid_connections=plaid_connections_count
        )

        return PointsResponse(
            total_points=total_points,
            breakdown=breakdown
        )

    except Exception as e:
        logger.error(f"Error calculating points for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating points: {str(e)}"
        )


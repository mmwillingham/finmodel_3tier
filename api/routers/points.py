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
    mfa_enabled: int = 0  # 1 if MFA is enabled, 0 otherwise
    federal_tax_enabled: int = 0  # 1 if federal tax calculations enabled
    cash_handling_enabled: int = 0  # 1 if cash handling configured
    social_security_enabled: int = 0  # 1 if SS inputs configured

class PointsResponse(BaseModel):
    total_points: int
    breakdown: PointsBreakdown
    model_config = ConfigDict(from_attributes=True)

class ChecklistResponse(BaseModel):
    has_account: bool
    has_asset: bool
    has_cash_flow_item: bool
    has_referral_sent: bool
    has_document_folder: bool
    has_document: bool
    has_connected_account: bool
    has_surplus_asset_account: bool
    has_auto_disbursement: bool
    mfa_enabled: bool
    federal_tax_enabled: bool
    cash_handling_enabled: bool
    social_security_enabled: bool

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

        # MFA enabled
        mfa_enabled = 1 if current_user.mfa_enabled else 0

        # Federal tax calculations enabled
        federal_tax_enabled = 1 if user_settings and user_settings.calculate_federal_tax else 0

        # Cash handling enabled (any cash handling selections configured)
        if user_settings:
            cash_asset_ids = user_settings.cash_asset_ids or []
            cash_in_source_ids = user_settings.cash_in_source_ids or []
            cash_out_source_ids = user_settings.cash_out_source_ids or []
            cash_handling_enabled = 1 if (cash_asset_ids or cash_in_source_ids or cash_out_source_ids) else 0
        else:
            cash_handling_enabled = 0

        # Social Security income enabled (any SS inputs configured)
        if user_settings:
            social_security_enabled = 1 if any([
                user_settings.person1_ss_pia,
                user_settings.person1_ss_retirement_date,
                user_settings.person1_ss_cola,
                user_settings.person2_ss_pia,
                user_settings.person2_ss_retirement_date,
                user_settings.person2_ss_cola,
                user_settings.person1_ss_monthly_benefit,
                user_settings.person2_ss_monthly_benefit,
            ]) else 0
        else:
            social_security_enabled = 0

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
            plaid_connections_count * 25 +  # Points per connected bank account
            mfa_enabled * 100  # Bonus points for MFA enabled
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
            plaid_connections=plaid_connections_count,
            mfa_enabled=mfa_enabled,
            federal_tax_enabled=federal_tax_enabled,
            cash_handling_enabled=cash_handling_enabled,
            social_security_enabled=social_security_enabled
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


@router.get("/checklist", response_model=ChecklistResponse)
def get_points_checklist(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    try:
        user_id = current_user.id

        accounts_count = db.query(func.count(models.Account.id)).filter(
            models.Account.owner_id == user_id
        ).scalar() or 0

        assets_count = db.query(func.count(models.Asset.id)).filter(
            models.Asset.owner_id == user_id
        ).scalar() or 0

        cashflow_count = db.query(func.count(models.CashFlowItem.id)).filter(
            models.CashFlowItem.owner_id == user_id
        ).scalar() or 0

        referrals_sent_count = db.query(func.count(models.Referral.id)).filter(
            models.Referral.referrer_id == user_id
        ).scalar() or 0

        folders_count = db.query(func.count(models.DocumentFolder.id)).filter(
            models.DocumentFolder.owner_id == user_id
        ).scalar() or 0

        documents_count = db.query(func.count(models.Document.id)).filter(
            models.Document.owner_id == user_id
        ).scalar() or 0

        user_settings = db.query(models.UserSettings).filter(
            models.UserSettings.owner_id == user_id
        ).first()

        surplus_asset_set = bool(user_settings and user_settings.surplus_asset_id is not None)

        auto_disbursements_count = db.query(func.count(models.AutoDisbursement.id)).filter(
            models.AutoDisbursement.owner_id == user_id
        ).scalar() or 0

        plaid_connections_count = db.query(func.count(models.PlaidItem.id)).filter(
            models.PlaidItem.owner_id == user_id
        ).scalar() or 0

        cash_asset_ids = (user_settings.cash_asset_ids if user_settings and user_settings.cash_asset_ids else [])
        cash_in_source_ids = (user_settings.cash_in_source_ids if user_settings and user_settings.cash_in_source_ids else [])
        cash_out_source_ids = (user_settings.cash_out_source_ids if user_settings and user_settings.cash_out_source_ids else [])
        cash_handling_enabled = bool(cash_asset_ids or cash_in_source_ids or cash_out_source_ids)

        social_security_enabled = bool(
            user_settings
            and (
                user_settings.person1_ss_pia
                or user_settings.person2_ss_pia
                or user_settings.person1_ss_retirement_date
                or user_settings.person2_ss_retirement_date
                or user_settings.person1_ss_monthly_benefit
                or user_settings.person2_ss_monthly_benefit
            )
        )

        federal_tax_enabled = bool(user_settings and user_settings.calculate_federal_tax)

        return ChecklistResponse(
            has_account=accounts_count > 0,
            has_asset=assets_count > 0,
            has_cash_flow_item=cashflow_count > 0,
            has_referral_sent=referrals_sent_count > 0,
            has_document_folder=folders_count > 0,
            has_document=documents_count > 0,
            has_connected_account=plaid_connections_count > 0,
            has_surplus_asset_account=surplus_asset_set,
            has_auto_disbursement=auto_disbursements_count > 0,
            mfa_enabled=bool(current_user.mfa_enabled),
            federal_tax_enabled=federal_tax_enabled,
            cash_handling_enabled=cash_handling_enabled,
            social_security_enabled=social_security_enabled
        )

    except Exception as e:
        logger.error(f"Error building checklist for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building checklist: {str(e)}"
        )


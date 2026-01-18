"""
Plaid Integration Router
Handles Plaid Link token creation, account connection, and data syncing.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import models
import schemas
import auth
import database
from utils.plaid_service import plaid_service
from utils.permission_dependencies import get_accessible_user_ids
import logging
from cryptography.fernet import Fernet
import os
import base64

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/plaid",
    tags=["plaid"],
    responses={404: {"description": "Not found"}},
)

# Encryption key for access tokens (should be stored securely in production)
# In production, use a proper key management system
def get_encryption_key() -> bytes:
    """Get encryption key for Plaid access tokens"""
    key = os.getenv("PLAID_ENCRYPTION_KEY")
    if not key:
        # Generate a key if not set (for development only)
        logger.warning("PLAID_ENCRYPTION_KEY not set. Using insecure default for development.")
        key = Fernet.generate_key().decode()
    else:
        # Ensure key is 32 bytes base64-encoded
        if len(key) != 44:  # Base64 encoded 32 bytes = 44 chars
            key = base64.urlsafe_b64encode(key.encode()[:32].ljust(32, b'0'))[:44].decode()
    return key.encode()

def encrypt_token(token: str) -> str:
    """Encrypt a Plaid access token"""
    f = Fernet(get_encryption_key())
    return f.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a Plaid access token"""
    f = Fernet(get_encryption_key())
    return f.decrypt(encrypted_token.encode()).decode()


@router.get("/link-token")
def create_link_token(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Create a Plaid Link token for initiating the Link flow."""
    if not plaid_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Plaid integration is not configured"
        )
    
    link_token = plaid_service.create_link_token(
        user_id=current_user.id,
        user_email=current_user.email
    )
    
    if not link_token:
        raise HTTPException(
            status_code=500,
            detail="Failed to create Plaid Link token"
        )
    
    return {"link_token": link_token}


@router.post("/exchange-public-token")
def exchange_public_token(
    request: schemas.PlaidExchangeTokenRequest,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Exchange a public token from Plaid Link for an access token and store it."""
    if not plaid_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Plaid integration is not configured"
        )
    
    # Exchange public token for access token
    token_data = plaid_service.exchange_public_token(request.public_token)
    if not token_data:
        raise HTTPException(
            status_code=400,
            detail="Failed to exchange public token"
        )
    
    # Get item information
    item_info = plaid_service.get_item_info(token_data['access_token'])
    if not item_info:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve item information"
        )
    
    # Check if item already exists
    existing_item = db.query(models.PlaidItem).filter(
        models.PlaidItem.item_id == token_data['item_id']
    ).first()
    
    if existing_item:
        # Update existing item
        existing_item.access_token = encrypt_token(token_data['access_token'])
        existing_item.institution_id = item_info.get('institution_id')
        existing_item.webhook = item_info.get('webhook')
        existing_item.error = item_info.get('error')
        existing_item.available_products = item_info.get('available_products')
        existing_item.billed_products = item_info.get('billed_products')
        if item_info.get('consent_expiration_time'):
            existing_item.consent_expiration_time = datetime.fromisoformat(
                item_info['consent_expiration_time'].replace('Z', '+00:00')
            )
        existing_item.updated_at = datetime.utcnow()
    else:
        # Create new item
        new_item = models.PlaidItem(
            owner_id=current_user.id,
            item_id=token_data['item_id'],
            access_token=encrypt_token(token_data['access_token']),
            institution_id=item_info.get('institution_id'),
            webhook=item_info.get('webhook'),
            error=item_info.get('error'),
            available_products=item_info.get('available_products'),
            billed_products=item_info.get('billed_products'),
        )
        if item_info.get('consent_expiration_time'):
            new_item.consent_expiration_time = datetime.fromisoformat(
                item_info['consent_expiration_time'].replace('Z', '+00:00')
            )
        db.add(new_item)
    
    db.commit()
    
    return {"item_id": token_data['item_id'], "status": "success"}


@router.post("/sync-accounts/{item_id}")
def sync_plaid_accounts(
    item_id: str,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Sync accounts from a Plaid item and create/update assets and brokerages.
    This will:
    1. Fetch accounts from Plaid
    2. Create or update Brokerage records
    3. Create or update Account records
    4. Create Asset records for each account balance
    """
    if not plaid_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Plaid integration is not configured"
        )
    
    # Get Plaid item
    plaid_item = db.query(models.PlaidItem).filter(
        models.PlaidItem.item_id == item_id,
        models.PlaidItem.owner_id == current_user.id
    ).first()
    
    if not plaid_item:
        raise HTTPException(
            status_code=404,
            detail="Plaid item not found"
        )
    
    # Decrypt access token
    try:
        access_token = decrypt_token(plaid_item.access_token)
    except Exception as e:
        logger.error(f"Error decrypting access token: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to decrypt access token"
        )
    
    # Get accounts from Plaid
    accounts = plaid_service.get_accounts(access_token)
    if not accounts:
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch accounts from Plaid"
        )
    
    # Get institution name (try to get from item or use a default)
    institution_name = plaid_item.institution_name or "Connected Institution"
    
    # Create or get brokerage
    brokerage = db.query(models.Brokerage).filter(
        models.Brokerage.owner_id == current_user.id,
        models.Brokerage.name == institution_name
    ).first()
    
    if not brokerage:
        brokerage = models.Brokerage(
            owner_id=current_user.id,
            name=institution_name
        )
        db.add(brokerage)
        db.flush()  # Get the ID
    
    # Get investment holdings if available
    holdings = plaid_service.get_investment_holdings(access_token)
    holdings_by_account = {}
    if holdings:
        for holding in holdings:
            account_id = holding.get('account_id')
            if account_id not in holdings_by_account:
                holdings_by_account[account_id] = []
            holdings_by_account[account_id].append(holding)
    
    # Process each account
    created_assets = []
    current_date = date.today().strftime("%Y-%m-%d")
    
    for plaid_account in accounts:
        account_id = plaid_account['account_id']
        account_name = plaid_account.get('official_name') or plaid_account['name']
        account_type = plaid_account['type']
        account_subtype = plaid_account.get('subtype', '')
        balance = plaid_account['balances'].get('current') or plaid_account['balances'].get('available') or 0.0
        mask = plaid_account.get('mask')
        
        # Determine if it's a retirement account
        is_retirement = account_subtype.lower() in ['ira', '401k', '403b', '401a', '457b', 'roth', 'roth 401k']
        
        # Create or get Account record
        account = db.query(models.Account).filter(
            models.Account.owner_id == current_user.id,
            models.Account.account_name == account_name,
            models.Account.brokerage_id == brokerage.id
        ).first()
        
        if not account:
            account = models.Account(
                owner_id=current_user.id,
                brokerage_id=brokerage.id,
                account_name=account_name,
                account_number=mask,
                is_retirement=is_retirement
            )
            db.add(account)
            db.flush()
        
        # Determine asset category based on account type
        if account_type == 'investment':
            category = 'Investment'
        elif account_type == 'depository':
            if account_subtype in ['checking', 'savings']:
                category = 'Cash'
            else:
                category = 'Depository'
        elif account_type == 'credit':
            category = 'Credit'
        else:
            category = 'Other'
        
        # Create asset for account balance
        asset_name = f"{account_name} - {institution_name}"
        if mask:
            asset_name += f" ({mask})"
        
        # Check if asset already exists for this account
        existing_asset = db.query(models.Asset).filter(
            models.Asset.owner_id == current_user.id,
            models.Asset.account_id == account.id,
            models.Asset.name == asset_name
        ).first()
        
        if existing_asset:
            # Update existing asset
            existing_asset.value = balance
            existing_asset.updated_at = datetime.utcnow()
            created_assets.append({
                'id': existing_asset.id,
                'name': existing_asset.name,
                'value': existing_asset.value,
                'action': 'updated'
            })
        else:
            # Create new asset
            new_asset = models.Asset(
                owner_id=current_user.id,
                name=asset_name,
                category=category,
                value=balance,
                account_id=account.id,
                start_date=current_date,
                annual_increase_percent=0.0
            )
            db.add(new_asset)
            db.flush()
            created_assets.append({
                'id': new_asset.id,
                'name': new_asset.name,
                'value': new_asset.value,
                'action': 'created'
            })
    
    # Update last successful sync time
    plaid_item.last_successful_update = datetime.utcnow()
    
    db.commit()
    
    return {
        "status": "success",
        "accounts_synced": len(accounts),
        "assets_created_or_updated": len(created_assets),
        "assets": created_assets
    }


@router.get("/items", response_model=List[schemas.PlaidItemOut])
def list_plaid_items(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List all Plaid items for the current user."""
    items = db.query(models.PlaidItem).filter(
        models.PlaidItem.owner_id == current_user.id
    ).order_by(models.PlaidItem.created_at.desc()).all()
    
    return items


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plaid_item(
    item_id: str,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Delete a Plaid item and optionally remove associated assets."""
    plaid_item = db.query(models.PlaidItem).filter(
        models.PlaidItem.item_id == item_id,
        models.PlaidItem.owner_id == current_user.id
    ).first()
    
    if not plaid_item:
        raise HTTPException(
            status_code=404,
            detail="Plaid item not found"
        )
    
    db.delete(plaid_item)
    db.commit()
    
    return None

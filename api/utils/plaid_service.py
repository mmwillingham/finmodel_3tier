"""
Plaid Service Utility
Handles all interactions with the Plaid API for connecting bank accounts.
"""
import os
from typing import Optional, Dict, Any, List
from datetime import date
from plaid import Client
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
import config
import logging

logger = logging.getLogger(__name__)

class PlaidService:
    """Service for interacting with Plaid API"""
    
    def __init__(self):
        """Initialize Plaid client"""
        if not config.settings.PLAID_CLIENT_ID or not config.settings.PLAID_SECRET:
            logger.warning("Plaid credentials not configured. Plaid features will be disabled.")
            self.client = None
            return
            
        try:
            self.client = Client(
                client_id=config.settings.PLAID_CLIENT_ID,
                secret=config.settings.PLAID_SECRET,
                environment=config.settings.PLAID_ENV.lower(),
                api_version='2020-09-14'
            )
        except Exception as e:
            logger.error(f"Failed to initialize Plaid client: {str(e)}")
            self.client = None
    
    def is_configured(self) -> bool:
        """Check if Plaid is properly configured"""
        return self.client is not None
    
    def create_link_token(self, user_id: int, user_email: str) -> Optional[str]:
        """
        Create a Plaid Link token for initiating the Link flow.
        
        Args:
            user_id: Internal user ID
            user_email: User's email address
            
        Returns:
            Link token string or None if error
        """
        if not self.is_configured():
            logger.error("Plaid not configured")
            return None
            
        try:
            # Convert product strings to Plaid Products enum
            products = []
            for product_str in config.settings.PLAID_PRODUCTS:
                try:
                    products.append(Products(product_str))
                except ValueError:
                    logger.warning(f"Invalid Plaid product: {product_str}")
            
            # Convert country code strings to CountryCode enum
            country_codes = [CountryCode(code) for code in config.settings.PLAID_COUNTRY_CODES]
            
            request = LinkTokenCreateRequest(
                products=products,
                client_name="Financial Model",
                country_codes=country_codes,
                language='en',
                user=LinkTokenCreateRequestUser(
                    client_user_id=str(user_id)
                ),
                redirect_uri=config.settings.PLAID_REDIRECT_URI if config.settings.PLAID_REDIRECT_URI else None
            )
            
            response = self.client.link_token_create(request)
            return response.get('link_token')
            
        except Exception as e:
            logger.error(f"Error creating Plaid link token: {str(e)}")
            return None
    
    def exchange_public_token(self, public_token: str) -> Optional[Dict[str, Any]]:
        """
        Exchange a public token for an access token.
        
        Args:
            public_token: Public token from Plaid Link
            
        Returns:
            Dictionary with access_token and item_id, or None if error
        """
        if not self.is_configured():
            logger.error("Plaid not configured")
            return None
            
        try:
            request = ItemPublicTokenExchangeRequest(public_token=public_token)
            response = self.client.item_public_token_exchange(request)
            
            return {
                'access_token': response.get('access_token'),
                'item_id': response.get('item_id')
            }
        except Exception as e:
            logger.error(f"Error exchanging public token: {str(e)}")
            return None
    
    def get_accounts(self, access_token: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get all accounts for a Plaid item.
        
        Args:
            access_token: Plaid access token
            
        Returns:
            List of account dictionaries or None if error
        """
        if not self.is_configured():
            logger.error("Plaid not configured")
            return None
            
        try:
            request = AccountsGetRequest(access_token=access_token)
            response = self.client.accounts_get(request)
            
            accounts = []
            for account in response.get('accounts', []):
                balances = account.get('balances', {})
                accounts.append({
                    'account_id': account.get('account_id'),
                    'name': account.get('name'),
                    'official_name': account.get('official_name'),
                    'type': account.get('type'),
                    'subtype': account.get('subtype'),
                    'mask': account.get('mask'),
                    'balances': {
                        'available': balances.get('available'),
                        'current': balances.get('current'),
                        'limit': balances.get('limit'),
                        'iso_currency_code': balances.get('iso_currency_code')
                    }
                })
            
            return accounts
            
        except Exception as e:
            logger.error(f"Error getting accounts: {str(e)}")
            return None
    
    def get_investment_holdings(self, access_token: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get investment holdings for a Plaid item.
        
        Args:
            access_token: Plaid access token
            
        Returns:
            List of holding dictionaries or None if error
        """
        if not self.is_configured():
            logger.error("Plaid not configured")
            return None
            
        try:
            request = InvestmentsHoldingsGetRequest(access_token=access_token)
            response = self.client.investments_holdings_get(request)
            
            holdings = []
            for holding in response.get('holdings', []):
                holdings.append({
                    'account_id': holding.get('account_id'),
                    'security_id': holding.get('security_id'),
                    'quantity': holding.get('quantity'),
                    'institution_price': holding.get('institution_price'),
                    'institution_value': holding.get('institution_value'),
                    'cost_basis': holding.get('cost_basis'),
                    'iso_currency_code': holding.get('iso_currency_code')
                })
            
            return holdings
            
        except Exception as e:
            logger.error(f"Error getting investment holdings: {str(e)}")
            return None
    
    def get_item_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Get item information including institution details.
        
        Args:
            access_token: Plaid access token
            
        Returns:
            Dictionary with item info or None if error
        """
        if not self.is_configured():
            logger.error("Plaid not configured")
            return None
            
        try:
            # Use accounts_get to get item info
            request = AccountsGetRequest(access_token=access_token)
            response = self.client.accounts_get(request)
            
            item = response.get('item', {})
            
            return {
                'item_id': item.get('item_id'),
                'institution_id': item.get('institution_id'),
                'webhook': item.get('webhook'),
                'error': item.get('error'),
                'available_products': item.get('available_products'),
                'billed_products': item.get('billed_products'),
                'consent_expiration_time': item.get('consent_expiration_time')
            }
            
        except Exception as e:
            logger.error(f"Error getting item info: {str(e)}")
            return None


# Singleton instance
plaid_service = PlaidService()

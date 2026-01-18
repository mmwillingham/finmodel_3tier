"""
Plaid Service Utility
Handles all interactions with the Plaid API for connecting bank accounts.
"""
import os
from typing import Optional, Dict, Any, List
from datetime import date
import plaid
from plaid.api import plaid_api
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
            logger.warning(f"Plaid credentials not configured. PLAID_CLIENT_ID present: {bool(config.settings.PLAID_CLIENT_ID)}, PLAID_SECRET present: {bool(config.settings.PLAID_SECRET)}, PLAID_ENV: {config.settings.PLAID_ENV}")
            self.client = None
            return
            
        try:
            # Map environment string to Plaid Environment enum
            # Note: Development environment was decommissioned in June 2024
            env_lower = config.settings.PLAID_ENV.lower()
            
            # Try to get the environment enum value (try lowercase first, then capitalized)
            if env_lower == 'sandbox':
                plaid_env = getattr(plaid.Environment, 'sandbox', getattr(plaid.Environment, 'Sandbox', None))
            elif env_lower == 'production':
                plaid_env = getattr(plaid.Environment, 'production', getattr(plaid.Environment, 'Production', None))
            else:
                logger.warning(f"Unknown Plaid environment '{config.settings.PLAID_ENV}', defaulting to sandbox")
                plaid_env = getattr(plaid.Environment, 'sandbox', getattr(plaid.Environment, 'Sandbox', None))
            
            if plaid_env is None:
                raise AttributeError("Could not find Plaid Environment enum value")
            
            configuration = plaid.Configuration(
                host=plaid_env,
                api_key={
                    'clientId': config.settings.PLAID_CLIENT_ID,
                    'secret': config.settings.PLAID_SECRET
                }
            )
            api_client = plaid.ApiClient(configuration)
            self.client = plaid_api.PlaidApi(api_client)
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
            
            # Build request parameters - only include redirect_uri if it's set (it's optional)
            request_params = {
                'products': products,
                'client_name': "Financial Model",
                'country_codes': country_codes,
                'language': 'en',
                'user': LinkTokenCreateRequestUser(
                    client_user_id=str(user_id)
                )
            }
            
            # Only include redirect_uri if it's configured (required for OAuth flows)
            if config.settings.PLAID_REDIRECT_URI:
                request_params['redirect_uri'] = config.settings.PLAID_REDIRECT_URI
            
            request = LinkTokenCreateRequest(**request_params)
            
            response = self.client.link_token_create(request)
            # Handle both dict and object responses
            if isinstance(response, dict):
                return response.get('link_token')
            else:
                return response.link_token
            
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
            
            # Handle both dict and object responses
            if isinstance(response, dict):
                return {
                    'access_token': response.get('access_token'),
                    'item_id': response.get('item_id')
                }
            else:
                return {
                    'access_token': response.access_token,
                    'item_id': response.item_id
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
            
            # Handle both dict and object responses
            accounts_data = response['accounts'] if isinstance(response, dict) else response.accounts
            item_data = response.get('item', {}) if isinstance(response, dict) else getattr(response, 'item', None)
            
            accounts = []
            for account in accounts_data:
                # Handle both dict and object account
                if isinstance(account, dict):
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
                else:
                    balances = account.balances
                    accounts.append({
                        'account_id': account.account_id,
                        'name': account.name,
                        'official_name': getattr(account, 'official_name', None),
                        'type': account.type,
                        'subtype': getattr(account, 'subtype', None),
                        'mask': getattr(account, 'mask', None),
                        'balances': {
                            'available': getattr(balances, 'available', None),
                            'current': getattr(balances, 'current', None),
                            'limit': getattr(balances, 'limit', None),
                            'iso_currency_code': getattr(balances, 'iso_currency_code', None)
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
            
            # Handle both dict and object responses
            holdings_data = response.get('holdings', []) if isinstance(response, dict) else getattr(response, 'holdings', [])
            
            holdings = []
            for holding in holdings_data:
                if isinstance(holding, dict):
                    holdings.append({
                        'account_id': holding.get('account_id'),
                        'security_id': holding.get('security_id'),
                        'quantity': holding.get('quantity'),
                        'institution_price': holding.get('institution_price'),
                        'institution_value': holding.get('institution_value'),
                        'cost_basis': holding.get('cost_basis'),
                        'iso_currency_code': holding.get('iso_currency_code')
                    })
                else:
                    holdings.append({
                        'account_id': holding.account_id,
                        'security_id': getattr(holding, 'security_id', None),
                        'quantity': getattr(holding, 'quantity', None),
                        'institution_price': getattr(holding, 'institution_price', None),
                        'institution_value': getattr(holding, 'institution_value', None),
                        'cost_basis': getattr(holding, 'cost_basis', None),
                        'iso_currency_code': getattr(holding, 'iso_currency_code', None)
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
            
            # Handle both dict and object responses
            if isinstance(response, dict):
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
            else:
                item = getattr(response, 'item', None)
                if item:
                    return {
                        'item_id': item.item_id,
                        'institution_id': getattr(item, 'institution_id', None),
                        'webhook': getattr(item, 'webhook', None),
                        'error': getattr(item, 'error', None),
                        'available_products': getattr(item, 'available_products', None),
                        'billed_products': getattr(item, 'billed_products', None),
                        'consent_expiration_time': getattr(item, 'consent_expiration_time', None)
                    }
                return None
            
        except Exception as e:
            logger.error(f"Error getting item info: {str(e)}")
            return None


# Singleton instance
plaid_service = PlaidService()

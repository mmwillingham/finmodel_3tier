from fastapi import HTTPException, status # Import HTTPException and status
import httpx
from urllib.parse import urlencode
from config import settings
import logging

logger = logging.getLogger(__name__) # Initialize logger

GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

def get_google_auth_url():
    """
    Generates the Google OAuth authorization URL.
    """
    # CRITICAL FIX: Use FRONTEND_URL for the redirect_uri
    redirect_uri = settings.FRONTEND_URL + "/auth/google/callback"
    logger.debug(f"Google OAuth: Constructed redirect_uri for authorization: {redirect_uri}") # NEW DEBUG LOG

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid profile email",
        "access_type": "offline", # To get refresh tokens
        "prompt": "consent", # To ensure refresh token is always granted on first auth
    }
    return f"{GOOGLE_AUTHORIZATION_URL}?{urlencode(params)}"

async def get_google_oauth_token(code: str):
    """
    Exchanges the authorization code for an access token.
    """
    # CRITICAL FIX: Use FRONTEND_URL for the redirect_uri
    redirect_uri = settings.FRONTEND_URL + "/auth/google/callback" # Re-declare for scope to ensure it's evaluated here
    logger.debug(f"Google OAuth: Constructed redirect_uri for token exchange: {redirect_uri}")
    
    # NEW DEBUG LOGS for client_id and client_secret
    logger.debug(f"Google OAuth: Sending client_id: {settings.GOOGLE_CLIENT_ID}")
    logger.debug(f"Google OAuth: Sending client_secret (first 5 chars): {settings.GOOGLE_CLIENT_SECRET[:5]}*****") # Log only first few chars for security

    async with httpx.AsyncClient() as client:
        try: # NEW: Add try-except block
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )
            response.raise_for_status() # Raise an exception for bad status codes
            return response.json()
        except httpx.HTTPStatusError as e: # Catch HTTP errors specifically
            # Log the full response text for detailed debugging
            logger.error(f"Google OAuth: Token exchange failed. Status: {e.response.status_code}, Response: {e.response.text}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Google OAuth token exchange failed: {e.response.status_code} - {e.response.text}"
            )
        except Exception as e: # Catch any other unexpected errors
            logger.error(f"Google OAuth: An unexpected error occurred during token exchange: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Google OAuth token exchange failed due to an unexpected error: {e}"
            )
async def get_google_user_info(access_token: str):
    """
    Fetches user information from Google using the access token.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GOOGLE_USER_INFO_URL,
            headers={
                "Authorization": f"Bearer {access_token}"
            }
        )
        response.raise_for_status()
        return response.json()
import httpx
from urllib.parse import urlencode
from config import settings

GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

def get_google_auth_url():
    """
    Generates the Google OAuth authorization URL.
    """
    # Ensure REDIRECT_URI is constructed here to use the dynamically loaded PUBLIC_BACKEND_URL
    redirect_uri = settings.PUBLIC_BACKEND_URL + "/auth/google/callback"

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
    redirect_uri = settings.PUBLIC_BACKEND_URL + "/auth/google/callback" # Re-declare for scope to ensure it's evaluated here
    async with httpx.AsyncClient() as client:
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
        response.raise_for_status()
        return response.json()

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
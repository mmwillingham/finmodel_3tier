import os
import re
from typing import Any
from pydantic_settings import BaseSettings

# In Cloud Run, environment variables are injected directly; .env files are for local development.

# Note: You may need to install pydantic-settings: pip install pydantic-settings

class Settings(BaseSettings):
    # Cloud SQL Connection Name (e.g., "your-project-id:your-region:your-instance-name")
    CLOUD_SQL_CONNECTION_NAME: str | None = os.getenv("CLOUD_SQL_CONNECTION_NAME", None)

    # Database credentials (used if not connecting via Cloud SQL connector)
    # These must be set via environment variables - no default values for security
    DB_USER: str = os.getenv("DB_USER", "")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "") or os.getenv("_DB_PASSWORD", "")  # Support Cloud Run secret format
    # Plaid secrets support Cloud Run secret format (prefixed with _)
    PLAID_SECRET: str | None = os.getenv("PLAID_SECRET", "") or os.getenv("_PLAID_SECRET", "")
    PLAID_ENCRYPTION_KEY: str | None = os.getenv("PLAID_ENCRYPTION_KEY", "") or os.getenv("_PLAID_ENCRYPTION_KEY", "")
    DB_NAME: str = os.getenv("DB_NAME", "")
    DB_HOST: str = os.getenv("DB_HOST", "localhost") # Used for local docker-compose setup
    DB_PORT: str = os.getenv("DB_PORT", "5432")

    # Dynamic DATABASE_URL construction
    DATABASE_URL: str | None = None # Make optional, populated in model_post_init

    # Public URL of the backend service (used for Google OAuth redirects)
    PUBLIC_BACKEND_URL: str | None = os.getenv("PUBLIC_BACKEND_URL", None)

    # Public URL of the frontend service (used for CORS configuration)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Google OAuth Settings
    GOOGLE_CLIENT_ID: str | None = os.getenv("GOOGLE_CLIENT_ID", "") # Default to empty string
    GOOGLE_CLIENT_SECRET: str | None = os.getenv("GOOGLE_CLIENT_SECRET", "") # Default to empty string

    # This automatically reads SECRET_KEY from the environment
    # SECRET_KEY is used for JWT encoding/decoding.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "INSECURE_FALLBACK_KEY") 
    
    # ALGORITHM is used to specify the hashing algorithm for JWTs.
    ALGORITHM: str = "HS256"
    
    # Expiration time for access tokens (24 hours for better UX with financial planning tool)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours 

    # Email settings
    MAIL_USERNAME: str | None = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD: str | None = os.getenv("MAIL_PASSWORD", "")
    MAIL_FROM: str | None = os.getenv("MAIL_FROM", "")
    MAIL_PORT: int = int(os.getenv("MAIL_PORT", 587))
    MAIL_SERVER: str | None = os.getenv("MAIL_SERVER", "")
    # Set via Cloud Build env: CORS_ORIGINS_REGEX (from _CORS_ORIGINS_REGEX)
    CORS_ORIGINS_REGEX: str | None = os.getenv("CORS_ORIGINS_REGEX", "")
    
    # Application name for emails
    APP_NAME: str = os.getenv("APP_NAME", "Financial Projector")

    # Stripe configuration
    STRIPE_API_KEY: str = os.getenv("STRIPE_API_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PREMIUM_PRICE_ID: str = os.getenv("STRIPE_PREMIUM_PRICE_ID", "")
    STRIPE_PRO_PRICE_ID: str = os.getenv("STRIPE_PRO_PRICE_ID", "")
    STRIPE_SUCCESS_URL: str = os.getenv("STRIPE_SUCCESS_URL", "http://localhost:3000/billing/success")
    STRIPE_CANCEL_URL: str = os.getenv("STRIPE_CANCEL_URL", "http://localhost:3000/billing/cancel")
    
    # Plaid API Settings
    # Support both direct env vars and Cloud Run secret format (prefixed with _)
    PLAID_CLIENT_ID: str | None = os.getenv("PLAID_CLIENT_ID", "") or os.getenv("_PLAID_CLIENT_ID", "")
    PLAID_ENV: str = os.getenv("PLAID_ENV", "sandbox")  # sandbox, development, or production
    PLAID_PRODUCTS: list[str] = ["transactions", "investments", "assets"]  # Products to request
    PLAID_COUNTRY_CODES: list[str] = ["US"]  # Country codes
    PLAID_REDIRECT_URI: str | None = os.getenv("PLAID_REDIRECT_URI", None)  # For OAuth flows
    
    # OpenAI API Settings
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY", "") or os.getenv("_OPENAI_API_KEY", "")
    OPENAI_MODEL_DEFAULT: str = os.getenv("OPENAI_MODEL_DEFAULT", "gpt-4o-mini")
    OPENAI_MODEL_PRO: str = os.getenv("OPENAI_MODEL_PRO", "gpt-4o")

    # Contact form rate limit (per hour)
    CONTACT_RATE_LIMIT_PER_HOUR: int = int(os.getenv("CONTACT_RATE_LIMIT_PER_HOUR", "5"))

    # MFA / OTP settings
    MFA_OTP_TTL_MINUTES: int = int(os.getenv("MFA_OTP_TTL_MINUTES", "10"))
    MFA_OTP_RATE_LIMIT_PER_HOUR: int = int(os.getenv("MFA_OTP_RATE_LIMIT_PER_HOUR", "5"))
    MFA_OTP_MAX_ATTEMPTS: int = int(os.getenv("MFA_OTP_MAX_ATTEMPTS", "5"))
    MFA_PASSKEY_CHALLENGE_TTL_MINUTES: int = int(os.getenv("MFA_PASSKEY_CHALLENGE_TTL_MINUTES", "10"))

    # WebAuthn / Passkey settings
    WEBAUTHN_RP_ID: str | None = os.getenv("WEBAUTHN_RP_ID", None)
    WEBAUTHN_RP_NAME: str = os.getenv("WEBAUTHN_RP_NAME", "Financial Projector")
    WEBAUTHN_ORIGIN: str | None = os.getenv("WEBAUTHN_ORIGIN", None)

    # Method to generate DATABASE_URL after validation
    def model_post_init(self, __context: Any) -> None:
        # NEW LOGIC: Use TCP/IP if DB_HOST is an IP address (Direct VPC Egress)
        if self.DB_HOST and not self.DB_HOST.startswith('/'):
            self.DATABASE_URL = (
                f"postgresql+pg8000://{str(self.DB_USER)}:{str(self.DB_PASSWORD)}"
                f"@{str(self.DB_HOST)}:{str(self.DB_PORT)}/{str(self.DB_NAME)}"
            )
        # OLD LOGIC: Fallback to Unix socket if only the Connection Name is provided
        elif self.CLOUD_SQL_CONNECTION_NAME:
            self.DATABASE_URL = (
                f"postgresql+pg8000://{str(self.DB_USER)}:{str(self.DB_PASSWORD)}"
                f"@/{str(self.DB_NAME)}?unix_sock=/cloudsql/{str(self.CLOUD_SQL_CONNECTION_NAME)}/.s.PGSQL.5432"
            )
        else:
            # Fallback for local development
            self.DATABASE_URL = (
                f"postgresql+pg8000://{str(self.DB_USER)}:{str(self.DB_PASSWORD)}"
                f"@{str(self.DB_HOST or 'localhost')}:{str(self.DB_PORT or '5432')}/{str(self.DB_NAME)}"
            )
        
        # --- Keep your existing URL and CORS logic below ---
        if self.PUBLIC_BACKEND_URL is None:
            self.PUBLIC_BACKEND_URL = "http://localhost:8000"
        if not (self.CORS_ORIGINS_REGEX and self.CORS_ORIGINS_REGEX.strip()):
            frontend_match = self.FRONTEND_URL.rstrip("/")
            if not frontend_match:
                frontend_match = self.FRONTEND_URL
            escaped_frontend = re.escape(frontend_match)
            self.CORS_ORIGINS_REGEX = rf"^{escaped_frontend}$"

# Instantiate the settings object once to be imported everywhere
settings = Settings()

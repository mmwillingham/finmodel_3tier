import os
from typing import Any
from pydantic_settings import BaseSettings

# In Cloud Run, environment variables are injected directly; .env files are for local development.

# Note: You may need to install pydantic-settings: pip install pydantic-settings

class Settings(BaseSettings):
    # Cloud SQL Connection Name (e.g., "your-project-id:your-region:your-instance-name")
    CLOUD_SQL_CONNECTION_NAME: str | None = os.getenv("CLOUD_SQL_CONNECTION_NAME", None)

    # Database credentials (used if not connecting via Cloud SQL connector)
    DB_USER: str = os.getenv("DB_USER", "bolauder")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "iamhe123")
    DB_NAME: str = os.getenv("DB_NAME", "finmodel")
    DB_HOST: str = os.getenv("DB_HOST", "localhost") # Used for local docker-compose setup
    DB_PORT: str = os.getenv("DB_PORT", "5432")

    # Dynamic DATABASE_URL construction
    DATABASE_URL: str | None = None # Make optional, populated in model_post_init

    # Public URL of the backend service (used for Google OAuth redirects)
    PUBLIC_BACKEND_URL: str | None = os.getenv("PUBLIC_BACKEND_URL", None)

    # Public URL of the frontend service (used for CORS configuration)
    FRONTEND_URL: str | None = os.getenv("FRONTEND_URL", None)

    # Google OAuth Settings
    GOOGLE_CLIENT_ID: str | None = os.getenv("GOOGLE_CLIENT_ID", "") # Default to empty string
    GOOGLE_CLIENT_SECRET: str | None = os.getenv("GOOGLE_CLIENT_SECRET", "") # Default to empty string

    # This automatically reads SECRET_KEY from the environment
    # SECRET_KEY is used for JWT encoding/decoding.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "INSECURE_FALLBACK_KEY") 
    
    # ALGORITHM is used to specify the hashing algorithm for JWTs.
    ALGORITHM: str = "HS256"
    
    # Expiration time for access tokens.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 

    # Email settings
    MAIL_USERNAME: str | None = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD: str | None = os.getenv("MAIL_PASSWORD", "")
    MAIL_FROM: str | None = os.getenv("MAIL_FROM", "")
    MAIL_PORT: int = int(os.getenv("MAIL_PORT", 587))
    MAIL_SERVER: str | None = os.getenv("MAIL_SERVER", "")
    CORS_ORIGINS_REGEX: str = os.getenv("CORS_ORIGINS_REGEX", "INJECT_CORS_ORIGINS_REGEX_HERE")
    

    # Method to generate DATABASE_URL after validation
    def model_post_init(self, __context: Any) -> None:
        # Construct DATABASE_URL using Cloud SQL connector format if CLOUD_SQL_CONNECTION_NAME is set
        if self.CLOUD_SQL_CONNECTION_NAME:
            self.DATABASE_URL = (
                f"postgresql+pg8000://{str(self.DB_USER)}:{str(self.DB_PASSWORD)}"
                f"@/{str(self.DB_NAME)}?unix_sock=/cloudsql/{str(self.CLOUD_SQL_CONNECTION_NAME)}/.s.PGSQL.5432"
            )
        else:
            # Fallback for local development or direct connection
            self.DATABASE_URL = (
                f"postgresql://{str(self.DB_USER)}:{str(self.DB_PASSWORD)}"
                f"@{str(self.DB_HOST)}:{str(self.DB_PORT)}/{str(self.DB_NAME)}"
            )
        
        # Set default Cloud Run URLs if environment variables are not provided
        if self.PUBLIC_BACKEND_URL is None:
            # K_SERVICE_URL is provided by Cloud Run for the service's public URL
            self.PUBLIC_BACKEND_URL = os.environ.get("K_SERVICE", "http://localhost:8000")
        if self.FRONTEND_URL is None:
            # Fallback to local for dev, or Cloud Run's environment will need to set it.
            self.FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Instantiate the settings object once to be imported everywhere
settings = Settings()
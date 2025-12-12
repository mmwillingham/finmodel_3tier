from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

# Load environment variables from .env file (for development)
load_dotenv() 

# Note: You may need to install pydantic-settings: pip install pydantic-settings

class Settings(BaseSettings):
    # This automatically reads SECRET_KEY from the environment
    # SECRET_KEY is used for JWT encoding/decoding.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "INSECURE_FALLBACK_KEY") 
    
    # ALGORITHM is used to specify the hashing algorithm for JWTs.
    ALGORITHM: str = "HS256"
    
    # Expiration time for access tokens.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 

    # Email settings
    MAIL_USERNAME: str = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD")
    MAIL_FROM: str = os.getenv("MAIL_FROM")
    MAIL_PORT: int = int(os.getenv("MAIL_PORT", 587))
    MAIL_SERVER: str = os.getenv("MAIL_SERVER")
    

# Instantiate the settings object once to be imported everywhere
settings = Settings()

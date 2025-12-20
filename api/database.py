import os
import time # NEW: Import time for sleep
from functools import lru_cache # NEW: Import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from typing import Any, Generator
from sqlalchemy.exc import OperationalError # NEW: Import OperationalError

# --- Database URL Construction (Cached for Performance) ---
@lru_cache(maxsize=1) # Cache the result of this function to avoid repeated computation
def get_database_url() -> str:
    """Constructs and returns a synchronous database URL (e.g., with pg8000) based on environment variables.
    Prioritizes DATABASE_URL if provided as a single environment variable.
    """
    database_url = os.getenv("DATABASE_URL")

    if database_url is None:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")

        if not all([db_user, db_password, db_name]):
            # CLOUD_SQL_CONNECTION_NAME is optional for local development
            raise ValueError("Missing one or more database environment variables (DB_USER, DB_PASSWORD, DB_NAME)")

        if cloud_sql_connection_name:
            db_host = os.getenv("DB_HOST", "127.0.0.1")
            
            if db_host.startswith("/cloudsql/"):
                # Use Unix socket
                database_url = (
                    f"postgresql+pg8000://{db_user}:{db_password}@{db_host}/{db_name}"
                )
            else:
                # Use TCP connection to the Cloud SQL Proxy (which runs on 127.0.0.1:5432 by default)
                db_port = os.getenv("DB_PORT", "5432")
                database_url = (
                    f"postgresql+pg8000://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
                )
        else:
            # Fallback for local development or direct connection
            # Use DB_HOST and DB_PORT from config.py's environment variable logic
            local_db_host = os.getenv("DB_HOST", "localhost")
            local_db_port = os.getenv("DB_PORT", "5432")
            database_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )
    
    if database_url is None:
        raise ValueError("DATABASE_URL could not be determined from environment variables.")
    
    print(f"DEBUG (database.py): Constructed SYNC SQLALCHEMY_DATABASE_URL: {database_url}")
    return database_url

@lru_cache(maxsize=1) # Cache the result of this function to ensure a single engine instance
def get_engine_instance():
    """Creates and returns a SQLAlchemy Engine with connection pooling configured, with retries."""
    DATABASE_URL = get_database_url()
    print(f"DEBUG (database.py): Using DATABASE_URL for engine: {DATABASE_URL}")
    
    retries = 5
    delay = 2 # seconds
    for i in range(retries):
        try:
            engine = create_engine(
                DATABASE_URL,
                pool_size=10,        # NEW: Number of connections to keep open in the pool
                max_overflow=20,     # NEW: Maximum number of connections to allow beyond pool_size
                pool_timeout=30,     # NEW: Number of seconds to wait before giving up on getting a connection from the pool
                pool_recycle=1800,   # NEW: Recycle connections after 30 minutes (1800 seconds) to prevent stale connections
                # Add other engine specific configs as needed
            )
            # Test the connection immediately
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print("DEBUG (database.py): Database engine created and connection tested successfully.")
            return engine
        except OperationalError as e:
            print(f"ERROR (database.py): Database connection failed (attempt {i+1}/{retries}): {e}")
            if i < retries - 1:
                time.sleep(delay)
            else:
                raise # Re-raise if all retries fail

# Instantiate the engine once at startup
engine = get_engine_instance()

# Create a SessionLocal class that will be used to create new session instances
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a new SQLAlchemy session for each request."""
    db = SessionLocal() # Create a new session from the pre-configured SessionLocal factory
    try:
        yield db
    finally:
        db.close()

# Note: The async database URL part is not used by the current FastAPI app for ORM operations, 
# but kept for potential future async database needs or Alembic specific async configurations.
# Ensure it also uses caching if it were to be actively used in a hot path.
@lru_cache(maxsize=1) # Cache the result of this function if it were to be used frequently
def get_async_database_url() -> str:
    """Constructs and returns an asynchronous database URL (e.g., with asyncpg) based on environment variables.
    Prioritizes DATABASE_URL if provided as a single environment variable.
    This is intended for asynchronous operations like Alembic migrations.
    """
    database_url = os.getenv("DATABASE_URL") # Check if a single DATABASE_URL is provided

    if database_url is None:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")

        if not all([db_user, db_password, db_name, cloud_sql_connection_name]):
            # This logic branch is typically for Cloud Run where CLOUD_SQL_CONNECTION_NAME is expected
            raise ValueError("Missing one or more database environment variables for async URL (DB_USER, DB_PASSWORD, DB_NAME, CLOUD_SQL_CONNECTION_NAME)")

        if cloud_sql_connection_name:
            # For async connections using Cloud SQL Proxy, connect via TCP to the proxy.
            # The proxy itself will handle the Unix socket connection to the Cloud SQL instance.
            db_host = os.getenv("DB_HOST", "127.0.0.1") # Default to localhost if running proxy with TCP on 127.0.0.1
            db_port = os.getenv("DB_PORT", "5432") # Default to 5432
            database_url = (
                f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
            )
        else:
            # Fallback for local development with a direct local PostgreSQL connection
            local_db_host = os.getenv("DB_HOST", "localhost")
            local_db_port = os.getenv("DB_PORT", "5432")
            database_url = (
                f"postgresql+asyncpg://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )
    if database_url is None:
        raise ValueError("ASYNC DATABASE_URL could not be determined from environment variables.")
    print(f"DEBUG (database.py): Constructed ASYNC SQLALCHEMY_DATABASE_URL: {database_url}")
    return database_url